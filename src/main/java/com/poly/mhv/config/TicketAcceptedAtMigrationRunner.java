package com.poly.mhv.config;

import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 12)
@RequiredArgsConstructor
public class TicketAcceptedAtMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final TicketRepository ticketRepository;
    private final TicketEventRepository ticketEventRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (!columnExists("tickets", "accepted_at")) {
            return;
        }

        List<Ticket> ticketsNeedingBackfill = ticketRepository.findAllForKpi().stream()
                .filter(ticket -> ticket.getAcceptedAt() == null)
                .filter(ticket -> ticket.getAssignee() != null)
                .filter(ticket -> "IN_PROGRESS".equals(ticket.getStatus()) || "RESOLVED".equals(ticket.getStatus()))
                .toList();
        if (ticketsNeedingBackfill.isEmpty()) {
            return;
        }

        List<Integer> ticketIds = ticketsNeedingBackfill.stream()
                .map(Ticket::getId)
                .filter(id -> id != null)
                .toList();
        Map<Integer, LocalDateTime> assignedAtByTicketId = ticketEventRepository
                .findByTicketIdInOrderByTicketIdAscOccurredAtAscIdAsc(ticketIds)
                .stream()
                .filter(event -> event.getTicket() != null && event.getTicket().getId() != null)
                .filter(event -> "TICKET_ASSIGNED".equals(event.getEventType()))
                .filter(event -> event.getOccurredAt() != null)
                .collect(Collectors.groupingBy(
                        event -> event.getTicket().getId(),
                        Collectors.collectingAndThen(
                                Collectors.minBy(Comparator.comparing(TicketEvent::getOccurredAt)),
                                optional -> optional.map(TicketEvent::getOccurredAt).orElse(null)
                        )
                ));

        List<Ticket> updatedTickets = ticketsNeedingBackfill.stream()
                .peek(ticket -> ticket.setAcceptedAt(
                        assignedAtByTicketId.getOrDefault(ticket.getId(), ticket.getCreatedAt())
                ))
                .toList();
        ticketRepository.saveAll(updatedTickets);
        log.warn("Backfilled accepted_at for {} legacy ticket rows", updatedTickets.size());
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }
}
