package com.poly.mhv.service;

import com.poly.mhv.dto.chat.ChatIncomingNotificationResponse;
import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.TicketRepository;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChatRealtimeService {

    private final TicketRepository ticketRepository;
    private final AsyncRealtimePushService asyncRealtimePushService;

    public void broadcastTicketMessage(Integer ticketId, ChatMessageResponse savedMessage, String senderUsername) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket để phát tin nhắn chat."));
        if (ticket.getReporter() != null) {
            asyncRealtimePushService.pushToDestination("/topic/users/" + ticket.getReporter().getId() + "/tickets/" + ticketId, savedMessage);
        }
        if (ticket.getAssignee() != null) {
            asyncRealtimePushService.pushToDestination("/topic/users/" + ticket.getAssignee().getId() + "/tickets/" + ticketId, savedMessage);
        }
        pushIncomingChatNotification(savedMessage, senderUsername);
    }

    private void pushIncomingChatNotification(ChatMessageResponse savedMessage, String senderUsername) {
        Ticket ticket = ticketRepository.findById(savedMessage.getTicketId())
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket để gửi thông báo chat."));
        Set<Integer> receivers = new java.util.HashSet<>();
        if (ticket.getReporter() != null) {
            receivers.add(ticket.getReporter().getId());
        }
        if (ticket.getAssignee() != null) {
            receivers.add(ticket.getAssignee().getId());
        }
        receivers.remove(savedMessage.getSenderId());

        String messagePreview = savedMessage.getContent();
        if (!org.springframework.util.StringUtils.hasText(messagePreview)) {
            if ("image".equalsIgnoreCase(savedMessage.getMediaType())) {
                messagePreview = "[Ảnh]";
            } else if ("audio".equalsIgnoreCase(savedMessage.getMediaType())) {
                messagePreview = "[Ghi âm]";
            } else {
                messagePreview = "Bạn có tin nhắn mới.";
            }
        }
        if (messagePreview.length() > 120) {
            messagePreview = messagePreview.substring(0, 120) + "...";
        }
        ChatIncomingNotificationResponse payload = ChatIncomingNotificationResponse.builder()
                .ticketId(savedMessage.getTicketId())
                .senderId(savedMessage.getSenderId())
                .senderName(senderUsername)
                .messagePreview(messagePreview)
                .createdAt(savedMessage.getCreatedAt())
                .build();
        for (Integer receiverId : receivers) {
            asyncRealtimePushService.pushToDestination("/topic/users/" + receiverId + "/chat-notifications", payload);
        }
    }
}
