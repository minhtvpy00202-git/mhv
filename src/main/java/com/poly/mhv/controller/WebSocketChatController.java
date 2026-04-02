package com.poly.mhv.controller;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.dto.chat.ChatMessageSendRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ChatService;
import com.poly.mhv.service.ChatRealtimeService;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final ChatService chatService;
    private final ChatRealtimeService chatRealtimeService;

    @MessageMapping("/chat/{ticketId}")
    public void sendMessage(
            @DestinationVariable Integer ticketId,
            @Payload ChatMessageSendRequest payload,
            Principal principal
    ) {
        if (payload != null && payload.getTicketId() != null && !ticketId.equals(payload.getTicketId())) {
            throw new CustomException("ticketId trong payload không khớp với destination.");
        }
        if (principal == null || principal.getName() == null) {
            throw new CustomException("Không xác định được người gửi từ phiên realtime.");
        }
        String content = payload != null ? payload.getContent() : null;
        ChatMessageResponse savedMessage = chatService.saveTicketMessage(ticketId, content, principal.getName());
        chatRealtimeService.broadcastTicketMessage(ticketId, savedMessage, principal.getName());
    }
}
