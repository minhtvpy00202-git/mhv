package com.poly.mhv.service;

import com.poly.mhv.dto.chat.ChatIncomingNotificationResponse;
import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.TicketRepository;
import java.util.HashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChatRealtimeService {

    private final TicketRepository ticketRepository;
    private final AppUserRepository appUserRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;

    public void broadcastTicketMessage(Integer ticketId, ChatMessageResponse savedMessage, String senderUsername) {
        simpMessagingTemplate.convertAndSend("/topic/tickets/" + ticketId, savedMessage);
        pushIncomingChatNotification(savedMessage, senderUsername);
    }

    private void pushIncomingChatNotification(ChatMessageResponse savedMessage, String senderUsername) {
        Ticket ticket = ticketRepository.findById(savedMessage.getTicketId())
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket để gửi thông báo chat."));
        Set<Integer> receivers = new HashSet<>();
        receivers.add(ticket.getReporter().getId());
        if (ticket.getAssignee() != null) {
            receivers.add(ticket.getAssignee().getId());
        }
        for (AppUser techSupport : appUserRepository.findByRole("TechSupport")) {
            receivers.add(techSupport.getId());
        }
        receivers.remove(savedMessage.getSenderId());

        String messagePreview = savedMessage.getContent();
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
            simpMessagingTemplate.convertAndSend("/topic/users/" + receiverId + "/chat-notifications", payload);
        }
    }
}
