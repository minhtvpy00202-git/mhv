package com.poly.mhv.repository;

import com.poly.mhv.entity.TicketEvent;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketEventRepository extends JpaRepository<TicketEvent, Integer> {
    List<TicketEvent> findByTicketIdOrderByOccurredAtDescIdDesc(Integer ticketId, Pageable pageable);

    List<TicketEvent> findByTicketIdInOrderByTicketIdAscOccurredAtAscIdAsc(List<Integer> ticketIds);

    List<TicketEvent> findByEventTypeOrderByOccurredAtDesc(String eventType);

    Optional<TicketEvent> findFirstByTicketIdAndEventTypeInOrderByOccurredAtDescIdDesc(
            Integer ticketId,
            Collection<String> eventTypes
    );

    Optional<TicketEvent> findFirstByTicketIdAndEventTypeInAndOccurredAtAfterOrderByOccurredAtAscIdAsc(
            Integer ticketId,
            Collection<String> eventTypes,
            LocalDateTime occurredAt
    );

    boolean existsByTicketIdAndEventType(Integer ticketId, String eventType);
}
