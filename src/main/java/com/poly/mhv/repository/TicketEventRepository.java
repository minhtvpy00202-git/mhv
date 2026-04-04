package com.poly.mhv.repository;

import com.poly.mhv.entity.TicketEvent;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketEventRepository extends JpaRepository<TicketEvent, Integer> {
    List<TicketEvent> findByTicketIdOrderByOccurredAtDescIdDesc(Integer ticketId, Pageable pageable);
}
