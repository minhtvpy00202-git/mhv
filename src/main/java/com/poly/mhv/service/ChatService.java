package com.poly.mhv.service;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.ChatMessage;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.ChatMessageRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final TicketRepository ticketRepository;
    private final AppUserRepository appUserRepository;

    @Transactional
    public ChatMessageResponse saveTicketMessage(Integer ticketId, String content, String senderUsername) {
        if (ticketId == null) {
            throw new CustomException("ticketId là bắt buộc.");
        }
        if (!StringUtils.hasText(content)) {
            throw new CustomException("content là bắt buộc.");
        }
        if (!StringUtils.hasText(senderUsername)) {
            throw new CustomException("Không xác định được người gửi.");
        }
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser sender = appUserRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new CustomException("Không tìm thấy người gửi."));
        ChatMessage chatMessage = ChatMessage.builder()
                .ticket(ticket)
                .sender(sender)
                .content(content.trim())
                .createdAt(LocalDateTime.now())
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getTicketChats(Integer ticketId, Integer limit) {
        if (ticketId == null) {
            throw new CustomException("ticketId là bắt buộc.");
        }
        if (!ticketRepository.existsById(ticketId)) {
            throw new CustomException("Không tìm thấy ticket.");
        }
        int safeLimit = limit == null ? 0 : limit;
        if (safeLimit > 0) {
            int bounded = Math.min(safeLimit, 200);
            return chatMessageRepository.findByTicketIdOrderByCreatedAtDesc(ticketId, PageRequest.of(0, bounded)).stream()
                    .sorted(Comparator.comparing(ChatMessage::getCreatedAt))
                    .map(this::mapToResponse)
                    .toList();
        }
        return chatMessageRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    private ChatMessageResponse mapToResponse(ChatMessage chatMessage) {
        return ChatMessageResponse.builder()
                .id(chatMessage.getId())
                .ticketId(chatMessage.getTicket().getId())
                .senderId(chatMessage.getSender().getId())
                .content(chatMessage.getContent())
                .createdAt(chatMessage.getCreatedAt())
                .build();
    }
}
