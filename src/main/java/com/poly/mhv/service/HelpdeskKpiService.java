package com.poly.mhv.service;

import com.poly.mhv.dto.dashboard.HelpdeskKpiResponse;
import com.poly.mhv.dto.dashboard.TechnicianTicketKpiResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HelpdeskKpiService {

    private static final long KPI_CACHE_TTL_MS = 30_000L;

    private final TicketRepository ticketRepository;
    private final AppUserRepository appUserRepository;
    private final TicketEventRepository ticketEventRepository;
    private final CurrentUserProvider currentUserProvider;
    private volatile CachedHelpdeskKpi adminCache;
    private final Map<Integer, CachedHelpdeskKpi> technicianCache = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public HelpdeskKpiResponse getAdminKpis() {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new CustomException("Chỉ admin mới được xem KPI toàn hệ thống.");
        }
        CachedHelpdeskKpi cacheSnapshot = adminCache;
        if (cacheSnapshot != null && !cacheSnapshot.isExpired()) {
            return cacheSnapshot.response();
        }
        List<Ticket> tickets = ticketRepository.findAllForKpi();
        List<AppUser> technicians = appUserRepository.findByRole("TechSupport").stream()
                .sorted(Comparator.comparing(this::getActorDisplayName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        long newTicketCount = tickets.stream().filter(ticket -> "PENDING".equals(ticket.getStatus())).count();
        long resolvedTicketCount = tickets.stream().filter(ticket -> "RESOLVED".equals(ticket.getStatus())).count();
        long inProgressTicketCount = tickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long activeTicketCount = countActiveTickets(tickets);
        long overdueTicketCount = countOverdueActiveTickets(tickets);
        FirstResponseMetrics firstResponseMetrics = buildFirstResponseMetrics(tickets);

        HelpdeskKpiResponse response = HelpdeskKpiResponse.builder()
                .scope("ADMIN")
                .newTicketCount(newTicketCount)
                .resolvedTicketCount(resolvedTicketCount)
                .inProgressTicketCount(inProgressTicketCount)
                .activeTicketCount(activeTicketCount)
                .overdueTicketCount(overdueTicketCount)
                .overdueSlaRate(calculateOverdueRate(overdueTicketCount, activeTicketCount))
                .averageResolutionMinutes(calculateAverageResolutionMinutes(tickets))
                .averageFirstResponseMinutes(firstResponseMetrics.averageFirstResponseMinutes())
                .ticketsByTechnician(
                        technicians.stream()
                                .map(technician -> mapTechnicianKpi(technician, tickets, firstResponseMetrics.averageMinutesByTechnician()))
                                .sorted(Comparator
                                        .comparingLong(TechnicianTicketKpiResponse::getAssignedTicketCount)
                                        .reversed()
                                        .thenComparing(TechnicianTicketKpiResponse::getTechnicianName, String.CASE_INSENSITIVE_ORDER))
                                .toList()
                )
                .build();
        adminCache = new CachedHelpdeskKpi(response, System.currentTimeMillis() + KPI_CACHE_TTL_MS);
        return response;
    }

    @Transactional(readOnly = true)
    public HelpdeskKpiResponse getCurrentTechnicianKpis() {
        AppUser technician = currentUserProvider.getCurrentUser();
        if (!"TechSupport".equals(technician.getRole())) {
            throw new CustomException("Chỉ kỹ thuật viên mới được xem KPI cá nhân.");
        }
        CachedHelpdeskKpi cacheSnapshot = technicianCache.get(technician.getId());
        if (cacheSnapshot != null && !cacheSnapshot.isExpired()) {
            return cacheSnapshot.response();
        }
        List<Ticket> tickets = ticketRepository.findAllForKpi();
        List<Ticket> myAssignedTickets = tickets.stream()
                .filter(ticket -> ticket.getAssignee() != null && technician.getId().equals(ticket.getAssignee().getId()))
                .toList();

        long newTicketCount = tickets.stream()
                .filter(ticket -> "PENDING".equals(ticket.getStatus()))
                .filter(ticket -> userCanHandleTicket(technician, ticket))
                .count();
        long resolvedTicketCount = myAssignedTickets.stream().filter(ticket -> "RESOLVED".equals(ticket.getStatus())).count();
        long inProgressTicketCount = myAssignedTickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long activeTicketCount = myAssignedTickets.stream().filter(ticket -> !"RESOLVED".equals(ticket.getStatus())).count();
        long overdueTicketCount = countOverdueActiveTickets(myAssignedTickets);
        FirstResponseMetrics firstResponseMetrics = buildFirstResponseMetrics(tickets);

        TechnicianTicketKpiResponse myRow = mapTechnicianKpi(technician, tickets, firstResponseMetrics.averageMinutesByTechnician());

        HelpdeskKpiResponse response = HelpdeskKpiResponse.builder()
                .scope("TECHNICIAN")
                .technicianId(technician.getId())
                .technicianName(getActorDisplayName(technician))
                .newTicketCount(newTicketCount)
                .resolvedTicketCount(resolvedTicketCount)
                .inProgressTicketCount(inProgressTicketCount)
                .activeTicketCount(activeTicketCount)
                .overdueTicketCount(overdueTicketCount)
                .overdueSlaRate(calculateOverdueRate(overdueTicketCount, activeTicketCount))
                .averageResolutionMinutes(calculateAverageResolutionMinutes(myAssignedTickets))
                .averageFirstResponseMinutes(firstResponseMetrics.averageMinutesByTechnician().getOrDefault(technician.getId(), 0L))
                .ticketsByTechnician(List.of(myRow))
                .build();
        technicianCache.put(technician.getId(), new CachedHelpdeskKpi(response, System.currentTimeMillis() + KPI_CACHE_TTL_MS));
        return response;
    }

    private TechnicianTicketKpiResponse mapTechnicianKpi(
            AppUser technician,
            List<Ticket> tickets,
            Map<Integer, Long> averageFirstResponseMinutesByTechnician
    ) {
        List<Ticket> assignedTickets = tickets.stream()
                .filter(ticket -> ticket.getAssignee() != null && technician.getId().equals(ticket.getAssignee().getId()))
                .toList();
        long resolvedCount = assignedTickets.stream().filter(ticket -> "RESOLVED".equals(ticket.getStatus())).count();
        long inProgressCount = assignedTickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long overdueCount = countOverdueActiveTickets(assignedTickets);

        return TechnicianTicketKpiResponse.builder()
                .technicianId(technician.getId())
                .technicianUsername(technician.getUsername())
                .technicianName(getActorDisplayName(technician))
                .assignedTicketCount(assignedTickets.size())
                .resolvedTicketCount(resolvedCount)
                .inProgressTicketCount(inProgressCount)
                .overdueTicketCount(overdueCount)
                .averageFirstResponseMinutes(averageFirstResponseMinutesByTechnician.getOrDefault(technician.getId(), 0L))
                .build();
    }

    private FirstResponseMetrics buildFirstResponseMetrics(List<Ticket> tickets) {
        List<Integer> ticketIds = tickets.stream()
                .map(Ticket::getId)
                .filter(id -> id != null)
                .toList();
        if (ticketIds.isEmpty()) {
            return new FirstResponseMetrics(0L, Map.of());
        }

        Map<Integer, List<TicketEvent>> eventsByTicketId = ticketEventRepository
                .findByTicketIdInOrderByTicketIdAscOccurredAtAscIdAsc(ticketIds)
                .stream()
                .collect(Collectors.groupingBy(event -> event.getTicket().getId()));

        Set<Integer> actorIds = eventsByTicketId.values().stream()
                .flatMap(List::stream)
                .map(TicketEvent::getActorId)
                .filter(actorId -> actorId != null)
                .collect(Collectors.toSet());

        Map<Integer, AppUser> usersById = actorIds.isEmpty()
                ? Map.of()
                : appUserRepository.findAllById(actorIds).stream()
                        .collect(Collectors.toMap(AppUser::getId, user -> user));

        List<FirstResponseSample> samples = tickets.stream()
                .map(ticket -> extractFirstResponseSample(ticket, eventsByTicketId.get(ticket.getId()), usersById))
                .flatMap(OptionalLongSample::stream)
                .toList();

        long average = Math.round(samples.stream()
                .mapToLong(FirstResponseSample::minutes)
                .average()
                .orElse(0));

        Map<Integer, Long> averageByTechnician = samples.stream()
                .collect(Collectors.groupingBy(
                        FirstResponseSample::technicianId,
                        Collectors.collectingAndThen(
                                Collectors.averagingLong(FirstResponseSample::minutes),
                                value -> Math.round(value)
                        )
                ));

        return new FirstResponseMetrics(average, averageByTechnician);
    }

    private OptionalLongSample extractFirstResponseSample(
            Ticket ticket,
            List<TicketEvent> events,
            Map<Integer, AppUser> usersById
    ) {
        if (ticket == null || ticket.getCreatedAt() == null || ticket.getAssignee() == null || events == null || events.isEmpty()) {
            return OptionalLongSample.empty();
        }

        Integer technicianId = ticket.getAssignee().getId();
        for (int index = 0; index < events.size(); index++) {
            TicketEvent event = events.get(index);
            if (!"TICKET_ASSIGNED".equals(event.getEventType()) || event.getOccurredAt() == null || event.getActorId() == null) {
                continue;
            }

            AppUser actor = usersById.get(event.getActorId());
            if (actor == null || actor.getRole() == null) {
                continue;
            }

            if ("TechSupport".equals(actor.getRole()) && technicianId.equals(actor.getId())) {
                return OptionalLongSample.of(technicianId, calculateMinutes(ticket.getCreatedAt(), event.getOccurredAt()));
            }

            if ("Admin".equals(actor.getRole())) {
                for (int nextIndex = index + 1; nextIndex < events.size(); nextIndex++) {
                    TicketEvent nextEvent = events.get(nextIndex);
                    if (nextEvent.getOccurredAt() == null || !technicianId.equals(nextEvent.getActorId())) {
                        continue;
                    }
                    if ("TICKET_CHAT".equals(nextEvent.getEventType()) || "TICKET_STATUS_CHANGED".equals(nextEvent.getEventType())) {
                        return OptionalLongSample.of(technicianId, calculateMinutes(event.getOccurredAt(), nextEvent.getOccurredAt()));
                    }
                }
            }
        }

        return OptionalLongSample.empty();
    }

    private long calculateMinutes(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            return 0L;
        }
        return Math.max(Duration.between(from, to).toMinutes(), 0L);
    }

    private long calculateAverageResolutionMinutes(List<Ticket> tickets) {
        return Math.round(tickets.stream()
                .filter(ticket -> "RESOLVED".equals(ticket.getStatus()))
                .filter(ticket -> ticket.getCreatedAt() != null && ticket.getResolvedAt() != null)
                .mapToLong(ticket -> Duration.between(ticket.getCreatedAt(), ticket.getResolvedAt()).toMinutes())
                .filter(minutes -> minutes >= 0)
                .average()
                .orElse(0));
    }

    private long countOverdueActiveTickets(List<Ticket> tickets) {
        LocalDateTime now = LocalDateTime.now();
        return tickets.stream()
                .filter(ticket -> !"RESOLVED".equals(ticket.getStatus()))
                .filter(ticket -> ticket.getDueDate() != null && ticket.getDueDate().isBefore(now))
                .count();
    }

    private long countActiveTickets(List<Ticket> tickets) {
        return tickets.stream()
                .filter(ticket -> !"RESOLVED".equals(ticket.getStatus()))
                .count();
    }

    private double calculateOverdueRate(long overdueTicketCount, long activeTicketCount) {
        if (activeTicketCount <= 0) {
            return 0D;
        }
        return (overdueTicketCount * 100.0D) / activeTicketCount;
    }

    private boolean userCanHandleTicket(AppUser technician, Ticket ticket) {
        if (technician == null || ticket == null || ticket.getAsset() == null || ticket.getAsset().getCategory() == null) {
            return false;
        }
        if (ticket.getAsset().getCategory().getTechSupportType() == null) {
            return false;
        }
        Integer requiredTechTypeId = ticket.getAsset().getCategory().getTechSupportType().getId();
        if (requiredTechTypeId == null || requiredTechTypeId <= 0) {
            return false;
        }
        Set<Integer> technicianTechTypeIds = technician.getTechSupportTypes() == null
                ? Set.of()
                : technician.getTechSupportTypes().stream()
                .filter(type -> type != null && type.getId() != null)
                .map(type -> type.getId())
                .collect(Collectors.toSet());
        return technicianTechTypeIds.contains(requiredTechTypeId);
    }

    private String getActorDisplayName(AppUser user) {
        if (user == null) {
            return "Hệ thống";
        }
        return user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName().trim()
                : user.getUsername();
    }

    private record FirstResponseMetrics(long averageFirstResponseMinutes, Map<Integer, Long> averageMinutesByTechnician) {
    }

    private record FirstResponseSample(Integer technicianId, long minutes) {
    }

    private static final class OptionalLongSample {
        private static final OptionalLongSample EMPTY = new OptionalLongSample(null);

        private final FirstResponseSample sample;

        private OptionalLongSample(FirstResponseSample sample) {
            this.sample = sample;
        }

        static OptionalLongSample of(Integer technicianId, long minutes) {
            return new OptionalLongSample(new FirstResponseSample(technicianId, Math.max(minutes, 0L)));
        }

        static OptionalLongSample empty() {
            return EMPTY;
        }

        java.util.stream.Stream<FirstResponseSample> stream() {
            return sample == null ? java.util.stream.Stream.empty() : java.util.stream.Stream.of(sample);
        }
    }

    private record CachedHelpdeskKpi(HelpdeskKpiResponse response, long expiresAt) {
        private boolean isExpired() {
            return expiresAt <= System.currentTimeMillis();
        }
    }
}
