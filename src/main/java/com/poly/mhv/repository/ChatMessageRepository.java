package com.poly.mhv.repository;

import com.poly.mhv.entity.ChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Integer> {
    List<ChatMessage> findByTicketIdOrderByCreatedAtAsc(Integer ticketId);
    List<ChatMessage> findByTicketIdOrderByCreatedAtDesc(Integer ticketId, Pageable pageable);
}
