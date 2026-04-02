package com.poly.mhv.controller;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.dto.chat.ChatMessageSendRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final ChatService chatService;
    private final SimpMessagingTemplate simpMessagingTemplate;

    @MessageMapping("/chat/{ticketId}")
    public void sendMessage(
            @DestinationVariable Integer ticketId,
            @Payload ChatMessageSendRequest payload
    ) {
        if (payload != null && payload.getTicketId() != null && !ticketId.equals(payload.getTicketId())) {
            throw new CustomException("ticketId trong payload không khớp với destination.");
        }
        String content = payload != null ? payload.getContent() : null;
        ChatMessageResponse savedMessage = chatService.saveTicketMessage(ticketId, content);
        simpMessagingTemplate.convertAndSend("/topic/tickets/" + ticketId, savedMessage);
    }
}
