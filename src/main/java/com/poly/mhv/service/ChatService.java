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
import java.util.Map;
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
    private final CurrentUserProvider currentUserProvider;
    private final ChatMediaStorageService chatMediaStorageService;
    private final TicketEventService ticketEventService;

    @Transactional
    public ChatMessageResponse saveTicketMessage(Integer ticketId, String content, String senderUsername) {
        if (ticketId == null) {
            throw new CustomException("ticketId là bắt buộc.");
        }
        if (!StringUtils.hasText(senderUsername)) {
            throw new CustomException("Không xác định được người gửi.");
        }
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser sender = appUserRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new CustomException("Không tìm thấy người gửi."));
        ensureCanAccessTicketChat(ticket, sender);
        ChatMediaStorageService.ProcessedChatPayload payload = chatMediaStorageService.processIncomingContent(content);
        ChatMessage chatMessage = ChatMessage.builder()
                .ticket(ticket)
                .sender(sender)
                .content(payload.content())
                .mediaUrl(payload.mediaUrl())
                .mediaType(payload.mediaType())
                .createdAt(LocalDateTime.now())
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        String preview = payload.content();
        if (!StringUtils.hasText(preview)) {
            preview = "image".equalsIgnoreCase(payload.mediaType()) ? "[Ảnh]" : "[Ghi âm]";
        }
        if (preview.length() > 120) {
            preview = preview.substring(0, 120) + "...";
        }
        ticketEventService.recordEvent(
                ticket,
                "TICKET_CHAT",
                sender,
                "Trao đổi trong ticket",
                Map.of("Nội dung", preview)
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getTicketChats(Integer ticketId, Integer limit) {
        if (ticketId == null) {
            throw new CustomException("ticketId là bắt buộc.");
        }
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanAccessTicketChat(ticket, actor);
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
                .mediaUrl(chatMessage.getMediaUrl())
                .mediaType(chatMessage.getMediaType())
                .createdAt(chatMessage.getCreatedAt())
                .build();
    }

    private void ensureCanAccessTicketChat(Ticket ticket, AppUser actor) {
        if (ticket == null || actor == null) {
            throw new CustomException("Không xác định được quyền truy cập chat.");
        }
        boolean isReporter = ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        boolean isAssignee = ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId());
        if (!isReporter && !isAssignee) {
            throw new CustomException("Bạn không có quyền truy cập chat của ticket này.");
        }
    }
}
