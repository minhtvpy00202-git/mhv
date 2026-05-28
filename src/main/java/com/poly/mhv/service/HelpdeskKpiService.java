package com.poly.mhv.service;

import com.poly.mhv.dto.dashboard.HelpdeskKpiResponse;
import com.poly.mhv.dto.dashboard.TechnicianTicketKpiResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InventoryAudit;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.InventoryAuditRepository;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
    private static final int REPEAT_INCIDENT_WINDOW_DAYS = 30;

    private final TicketRepository ticketRepository;
    private final AppUserRepository appUserRepository;
    private final TicketEventRepository ticketEventRepository;
    private final AssetRepository assetRepository;
    private final InventoryAuditRepository inventoryAuditRepository;
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
        List<Ticket> resolvedTickets = tickets.stream().filter(ticket -> "RESOLVED".equals(ticket.getStatus())).toList();
        List<AppUser> technicians = appUserRepository.findByRole("TechSupport").stream()
                .sorted(Comparator.comparing(this::getActorDisplayName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        long newTicketCount = tickets.stream().filter(ticket -> "PENDING".equals(ticket.getStatus())).count();
        long resolvedTicketCount = resolvedTickets.size();
        long inProgressTicketCount = tickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long activeTicketCount = countActiveTickets(tickets);
        long overdueTicketCount = countOverdueActiveTickets(tickets);
        FirstResponseMetrics firstResponseMetrics = buildFirstResponseMetrics(tickets);
        Set<Integer> repeatIncidentTicketIds = collectRepeatIncidentTicketIds(tickets);
        long repeatIncidentCount = countRepeatIncidentResolvedTickets(resolvedTickets, repeatIncidentTicketIds);
        long onTimeResolvedTicketCount = countResolvedOnTimeTickets(resolvedTickets);
        long totalAssetCount = assetRepository.countAllAssets();
        long healthyAssetCount = assetRepository.countAvailableAssets(
                "Hoạt động tốt",
                "Tại vị trí gốc"
        ) + assetRepository.countBorrowedAssets("Hoạt động tốt", "Đang cho mượn");
        long totalConsumableCount = assetRepository.countAllConsumables();
        long lowStockConsumableCount = assetRepository.countLowStockConsumables();
        AuditMetrics auditMetrics = buildAuditMetrics();
        SatisfactionMetrics adminSatisfactionMetrics = buildSatisfactionMetrics(resolvedTickets);

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
                .onTimeSlaRate(calculateRate(onTimeResolvedTicketCount, resolvedTicketCount))
                .onTimeResolvedTicketCount(onTimeResolvedTicketCount)
                .healthyAssetRate(calculateRate(healthyAssetCount, totalAssetCount))
                .healthyAssetCount(healthyAssetCount)
                .totalAssetCount(totalAssetCount)
                .repeatIncidentRate(calculateRate(repeatIncidentCount, resolvedTicketCount))
                .repeatIncidentCount(repeatIncidentCount)
                .lowStockConsumableRate(calculateRate(lowStockConsumableCount, totalConsumableCount))
                .lowStockConsumableCount(lowStockConsumableCount)
                .totalConsumableCount(totalConsumableCount)
                .onTimeAuditRate(calculateRate(auditMetrics.onTimeCount(), auditMetrics.sampleCount()))
                .onTimeAuditCount(auditMetrics.onTimeCount())
                .auditDueDateSampleCount(auditMetrics.sampleCount())
                .averageSatisfactionScore(adminSatisfactionMetrics.averageScore())
                .satisfactionSampleCount(adminSatisfactionMetrics.sampleCount())
                .ticketsByTechnician(
                        technicians.stream()
                                .map(technician -> mapTechnicianKpi(technician, tickets, firstResponseMetrics, repeatIncidentTicketIds))
                                .sorted(Comparator
                                        .comparingDouble(TechnicianTicketKpiResponse::getPerformanceScore)
                                        .reversed()
                                        .thenComparing(Comparator.comparingLong(TechnicianTicketKpiResponse::getAssignedTicketCount).reversed())
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
        Set<Integer> repeatIncidentTicketIds = collectRepeatIncidentTicketIds(tickets);
        List<Ticket> myAssignedTickets = tickets.stream()
                .filter(ticket -> ticket.getAssignee() != null && technician.getId().equals(ticket.getAssignee().getId()))
                .toList();
        List<Ticket> myResolvedTickets = myAssignedTickets.stream()
                .filter(ticket -> "RESOLVED".equals(ticket.getStatus()))
                .toList();

        long newTicketCount = tickets.stream()
                .filter(ticket -> "PENDING".equals(ticket.getStatus()))
                .filter(ticket -> userCanHandleTicket(technician, ticket))
                .count();
        long resolvedTicketCount = myResolvedTickets.size();
        long inProgressTicketCount = myAssignedTickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long activeTicketCount = myAssignedTickets.stream().filter(ticket -> !"RESOLVED".equals(ticket.getStatus())).count();
        long overdueTicketCount = countOverdueActiveTickets(myAssignedTickets);
        FirstResponseMetrics firstResponseMetrics = buildFirstResponseMetrics(tickets);
        long repeatIncidentCount = countRepeatIncidentResolvedTickets(myResolvedTickets, repeatIncidentTicketIds);
        long firstTimeFixCount = Math.max(resolvedTicketCount - repeatIncidentCount, 0);
        long onTimeResolvedTicketCount = countResolvedOnTimeTickets(myResolvedTickets);
        long fastResponseCount = firstResponseMetrics.fastResponseCountByTechnician().getOrDefault(technician.getId(), 0L);
        long fastResponseSampleCount = firstResponseMetrics.sampleCountByTechnician().getOrDefault(technician.getId(), 0L);
        SatisfactionMetrics mySatisfactionMetrics = buildSatisfactionMetrics(myResolvedTickets);

        TechnicianTicketKpiResponse myRow = mapTechnicianKpi(technician, tickets, firstResponseMetrics, repeatIncidentTicketIds);

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
                .fastResponseRate(myRow.getFastResponseRate())
                .fastResponseCount(fastResponseCount)
                .fastResponseSampleCount(fastResponseSampleCount)
                .onTimeResolutionRate(calculateRate(onTimeResolvedTicketCount, resolvedTicketCount))
                .onTimeResolvedTicketCount(onTimeResolvedTicketCount)
                .repeatIncidentRate(calculateRate(repeatIncidentCount, resolvedTicketCount))
                .repeatIncidentCount(repeatIncidentCount)
                .firstTimeFixRate(calculateRate(firstTimeFixCount, resolvedTicketCount))
                .firstTimeFixCount(firstTimeFixCount)
                .averageSatisfactionScore(mySatisfactionMetrics.averageScore())
                .satisfactionSampleCount(mySatisfactionMetrics.sampleCount())
                .performanceScore(myRow.getPerformanceScore())
                .performanceGrade(myRow.getPerformanceGrade())
                .ticketsByTechnician(List.of(myRow))
                .build();
        technicianCache.put(technician.getId(), new CachedHelpdeskKpi(response, System.currentTimeMillis() + KPI_CACHE_TTL_MS));
        return response;
    }

    private TechnicianTicketKpiResponse mapTechnicianKpi(
            AppUser technician,
            List<Ticket> tickets,
            FirstResponseMetrics firstResponseMetrics,
            Set<Integer> repeatIncidentTicketIds
    ) {
        List<Ticket> assignedTickets = tickets.stream()
                .filter(ticket -> ticket.getAssignee() != null && technician.getId().equals(ticket.getAssignee().getId()))
                .toList();
        List<Ticket> resolvedTickets = assignedTickets.stream().filter(ticket -> "RESOLVED".equals(ticket.getStatus())).toList();
        long resolvedCount = resolvedTickets.size();
        long inProgressCount = assignedTickets.stream().filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus())).count();
        long overdueCount = countOverdueActiveTickets(assignedTickets);
        long onTimeResolvedCount = countResolvedOnTimeTickets(resolvedTickets);
        long repeatIncidentCount = countRepeatIncidentResolvedTickets(resolvedTickets, repeatIncidentTicketIds);
        long firstTimeFixCount = Math.max(resolvedCount - repeatIncidentCount, 0);
        long fastResponseCount = firstResponseMetrics.fastResponseCountByTechnician().getOrDefault(technician.getId(), 0L);
        long fastResponseSampleCount = firstResponseMetrics.sampleCountByTechnician().getOrDefault(technician.getId(), 0L);
        double fastResponseRate = calculateRate(fastResponseCount, fastResponseSampleCount);
        double onTimeResolutionRate = calculateRate(onTimeResolvedCount, resolvedCount);
        double repeatIncidentRate = calculateRate(repeatIncidentCount, resolvedCount);
        double firstTimeFixRate = calculateRate(firstTimeFixCount, resolvedCount);
        long averageResolutionMinutes = calculateAverageResolutionMinutes(assignedTickets);
        SatisfactionMetrics satisfactionMetrics = buildSatisfactionMetrics(resolvedTickets);
        double performanceScore = calculateTechnicianPerformanceScore(
                fastResponseRate,
                onTimeResolutionRate,
                averageResolutionMinutes,
                repeatIncidentRate,
                firstTimeFixRate,
                satisfactionMetrics.averageScore(),
                satisfactionMetrics.sampleCount()
        );

        return TechnicianTicketKpiResponse.builder()
                .technicianId(technician.getId())
                .technicianUsername(technician.getUsername())
                .technicianName(getActorDisplayName(technician))
                .assignedTicketCount(assignedTickets.size())
                .resolvedTicketCount(resolvedCount)
                .inProgressTicketCount(inProgressCount)
                .overdueTicketCount(overdueCount)
                .averageFirstResponseMinutes(firstResponseMetrics.averageMinutesByTechnician().getOrDefault(technician.getId(), 0L))
                .averageResolutionMinutes(averageResolutionMinutes)
                .fastResponseRate(fastResponseRate)
                .onTimeResolutionRate(onTimeResolutionRate)
                .repeatIncidentRate(repeatIncidentRate)
                .firstTimeFixRate(firstTimeFixRate)
                .averageSatisfactionScore(satisfactionMetrics.averageScore())
                .satisfactionSampleCount(satisfactionMetrics.sampleCount())
                .performanceScore(performanceScore)
                .performanceGrade(derivePerformanceGrade(performanceScore))
                .build();
    }

    private FirstResponseMetrics buildFirstResponseMetrics(List<Ticket> tickets) {
        List<Integer> ticketIds = tickets.stream()
                .map(Ticket::getId)
                .filter(id -> id != null)
                .toList();
        if (ticketIds.isEmpty()) {
            return new FirstResponseMetrics(0L, Map.of(), 0L, 0L, Map.of(), Map.of());
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
                .flatMap(Optional::stream)
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

        long fastResponseCount = samples.stream().filter(FirstResponseSample::withinTarget).count();
        Map<Integer, Long> fastResponseCountByTechnician = samples.stream()
                .filter(FirstResponseSample::withinTarget)
                .collect(Collectors.groupingBy(FirstResponseSample::technicianId, Collectors.counting()));
        Map<Integer, Long> sampleCountByTechnician = samples.stream()
                .collect(Collectors.groupingBy(FirstResponseSample::technicianId, Collectors.counting()));

        return new FirstResponseMetrics(
                average,
                averageByTechnician,
                fastResponseCount,
                samples.size(),
                fastResponseCountByTechnician,
                sampleCountByTechnician
        );
    }

    private Optional<FirstResponseSample> extractFirstResponseSample(
            Ticket ticket,
            List<TicketEvent> events,
            Map<Integer, AppUser> usersById
    ) {
        if (ticket == null || ticket.getCreatedAt() == null || ticket.getAssignee() == null) {
            return Optional.empty();
        }

        if (ticket.getAcceptedAt() != null) {
            long responseMinutes = calculateMinutes(ticket.getCreatedAt(), ticket.getAcceptedAt());
            return Optional.of(new FirstResponseSample(
                    ticket.getAssignee().getId(),
                    responseMinutes,
                    isFastResponse(ticket.getPriority(), responseMinutes)
            ));
        }

        if (events == null || events.isEmpty()) {
            return Optional.empty();
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
                long responseMinutes = calculateMinutes(ticket.getCreatedAt(), event.getOccurredAt());
                return Optional.of(new FirstResponseSample(
                        technicianId,
                        responseMinutes,
                        isFastResponse(ticket.getPriority(), responseMinutes)
                ));
            }

            if ("Admin".equals(actor.getRole())) {
                for (int nextIndex = index + 1; nextIndex < events.size(); nextIndex++) {
                    TicketEvent nextEvent = events.get(nextIndex);
                    if (nextEvent.getOccurredAt() == null || !technicianId.equals(nextEvent.getActorId())) {
                        continue;
                    }
                    if ("TICKET_CHAT".equals(nextEvent.getEventType()) || "TICKET_STATUS_CHANGED".equals(nextEvent.getEventType())) {
                        long responseMinutes = calculateMinutes(event.getOccurredAt(), nextEvent.getOccurredAt());
                        return Optional.of(new FirstResponseSample(
                                technicianId,
                                responseMinutes,
                                isFastResponse(ticket.getPriority(), responseMinutes)
                        ));
                    }
                }
            }
        }

        return Optional.empty();
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
                .filter(ticket -> resolveAcceptedBaseline(ticket) != null && ticket.getResolvedAt() != null)
                .mapToLong(ticket -> Duration.between(resolveAcceptedBaseline(ticket), ticket.getResolvedAt()).toMinutes())
                .filter(minutes -> minutes >= 0)
                .average()
                .orElse(0));
    }

    private LocalDateTime resolveAcceptedBaseline(Ticket ticket) {
        if (ticket == null) {
            return null;
        }
        return ticket.getAcceptedAt() != null ? ticket.getAcceptedAt() : ticket.getCreatedAt();
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

    private long countResolvedOnTimeTickets(List<Ticket> resolvedTickets) {
        return resolvedTickets.stream()
                .filter(ticket -> ticket.getResolvedAt() != null && ticket.getDueDate() != null)
                .filter(ticket -> !ticket.getResolvedAt().isAfter(ticket.getDueDate()))
                .count();
    }

    private Set<Integer> collectRepeatIncidentTicketIds(List<Ticket> tickets) {
        return tickets.stream()
                .filter(ticket -> ticket.getAsset() != null && ticket.getAsset().getQaCode() != null)
                .collect(Collectors.groupingBy(ticket -> ticket.getAsset().getQaCode()))
                .values().stream()
                .flatMap(groupedTickets -> {
                    List<Ticket> sortedTickets = groupedTickets.stream()
                            .sorted(Comparator
                                    .comparing(Ticket::getCreatedAt, Comparator.nullsLast(LocalDateTime::compareTo))
                                    .thenComparing(Ticket::getId, Comparator.nullsLast(Integer::compareTo)))
                            .toList();
                    Set<Integer> ticketIds = new java.util.HashSet<>();
                    for (int index = 0; index < sortedTickets.size(); index++) {
                        Ticket current = sortedTickets.get(index);
                        if (!"RESOLVED".equals(current.getStatus()) || current.getResolvedAt() == null || current.getId() == null) {
                            continue;
                        }
                        LocalDateTime repeatDeadline = current.getResolvedAt().plusDays(REPEAT_INCIDENT_WINDOW_DAYS);
                        boolean repeated = false;
                        for (int nextIndex = index + 1; nextIndex < sortedTickets.size(); nextIndex++) {
                            Ticket next = sortedTickets.get(nextIndex);
                            if (next.getCreatedAt() == null) {
                                continue;
                            }
                            if (next.getCreatedAt().isBefore(current.getResolvedAt())) {
                                continue;
                            }
                            if (!next.getCreatedAt().isAfter(repeatDeadline)) {
                                repeated = true;
                            }
                            break;
                        }
                        if (repeated) {
                            ticketIds.add(current.getId());
                        }
                    }
                    return ticketIds.stream();
                })
                .collect(Collectors.toSet());
    }

    private long countRepeatIncidentResolvedTickets(List<Ticket> resolvedTickets, Set<Integer> repeatIncidentTicketIds) {
        return resolvedTickets.stream()
                .map(Ticket::getId)
                .filter(id -> id != null && repeatIncidentTicketIds.contains(id))
                .count();
    }

    private double calculateOverdueRate(long overdueTicketCount, long activeTicketCount) {
        return calculateRate(overdueTicketCount, activeTicketCount);
    }

    private double calculateRate(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0D;
        }
        return roundOneDecimal((numerator * 100.0D) / denominator);
    }

    private boolean isFastResponse(String priority, long responseMinutes) {
        long targetMinutes = switch (priority == null ? "" : priority.trim().toUpperCase()) {
            case "HIGH" -> 15L;
            case "LOW" -> 60L;
            default -> 30L;
        };
        return responseMinutes <= targetMinutes;
    }

    private AuditMetrics buildAuditMetrics() {
        List<InventoryAudit> audits = inventoryAuditRepository.findAll();
        List<InventoryAudit> sampledAudits = audits.stream()
                .filter(audit -> audit.getDueDate() != null && audit.getCompletedAt() != null)
                .toList();
        long onTimeCount = sampledAudits.stream()
                .filter(audit -> !audit.getCompletedAt().isAfter(audit.getDueDate()))
                .count();
        return new AuditMetrics(onTimeCount, sampledAudits.size());
    }

    private double calculateTechnicianPerformanceScore(
            double fastResponseRate,
            double onTimeResolutionRate,
            long averageResolutionMinutes,
            double repeatIncidentRate,
            double firstTimeFixRate,
            double averageSatisfactionScore,
            long satisfactionSampleCount
    ) {
        double weightedScoreSum = (scorePositiveRate(fastResponseRate) * 0.15D)
                + (scorePositiveRate(onTimeResolutionRate) * 0.20D)
                + (scoreResolutionTime(averageResolutionMinutes) * 0.15D)
                + (scoreNegativeRate(repeatIncidentRate) * 0.15D)
                + (scorePositiveRate(firstTimeFixRate) * 0.15D);
        double totalWeight = 0.80D;
        if (satisfactionSampleCount > 0) {
            weightedScoreSum += scoreSatisfaction(averageSatisfactionScore) * 0.20D;
            totalWeight += 0.20D;
        }
        if (totalWeight <= 0D) {
            return 0D;
        }
        return roundOneDecimal(weightedScoreSum / totalWeight);
    }

    private double scorePositiveRate(double rate) {
        if (rate >= 95D) {
            return 100D;
        }
        if (rate >= 90D) {
            return 90D;
        }
        if (rate >= 80D) {
            return 80D;
        }
        if (rate >= 70D) {
            return 65D;
        }
        return 40D;
    }

    private double scoreNegativeRate(double rate) {
        if (rate <= 5D) {
            return 100D;
        }
        if (rate <= 10D) {
            return 90D;
        }
        if (rate <= 15D) {
            return 80D;
        }
        if (rate <= 20D) {
            return 65D;
        }
        return 40D;
    }

    private double scoreResolutionTime(long minutes) {
        if (minutes <= 0L) {
            return 0D;
        }
        if (minutes <= 480L) {
            return 100D;
        }
        if (minutes <= 960L) {
            return 90D;
        }
        if (minutes <= 1_440L) {
            return 80D;
        }
        if (minutes <= 2_880L) {
            return 65D;
        }
        return 40D;
    }

    private double scoreSatisfaction(double averageScore) {
        if (averageScore >= 4.75D) {
            return 100D;
        }
        if (averageScore >= 4.25D) {
            return 90D;
        }
        if (averageScore >= 3.75D) {
            return 80D;
        }
        if (averageScore >= 3.0D) {
            return 65D;
        }
        if (averageScore > 0D) {
            return 40D;
        }
        return 0D;
    }

    private SatisfactionMetrics buildSatisfactionMetrics(List<Ticket> tickets) {
        List<Integer> scores = tickets.stream()
                .map(Ticket::getSatisfactionScore)
                .filter(score -> score != null && score > 0)
                .toList();
        if (scores.isEmpty()) {
            return new SatisfactionMetrics(0D, 0L);
        }
        double averageScore = roundOneDecimal(scores.stream()
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0D));
        return new SatisfactionMetrics(averageScore, scores.size());
    }

    private String derivePerformanceGrade(double score) {
        if (score >= 90D) {
            return "Xuất sắc";
        }
        if (score >= 80D) {
            return "Tốt";
        }
        if (score >= 65D) {
            return "Khá";
        }
        if (score >= 50D) {
            return "Trung bình";
        }
        return "Yếu";
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0D) / 10.0D;
    }

    public void invalidateCaches() {
        adminCache = null;
        technicianCache.clear();
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

    private record FirstResponseMetrics(
            long averageFirstResponseMinutes,
            Map<Integer, Long> averageMinutesByTechnician,
            long fastResponseCount,
            long sampleCount,
            Map<Integer, Long> fastResponseCountByTechnician,
            Map<Integer, Long> sampleCountByTechnician
    ) {
    }

    private record FirstResponseSample(Integer technicianId, long minutes, boolean withinTarget) {
    }

    private record AuditMetrics(long onTimeCount, long sampleCount) {
    }

    private record SatisfactionMetrics(double averageScore, long sampleCount) {
    }

    private record CachedHelpdeskKpi(HelpdeskKpiResponse response, long expiresAt) {
        private boolean isExpired() {
            return expiresAt <= System.currentTimeMillis();
        }
    }
}
