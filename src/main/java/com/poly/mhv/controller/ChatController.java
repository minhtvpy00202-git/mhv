package com.poly.mhv.controller;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.dto.chat.ChatMessageSendRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ChatService;
import com.poly.mhv.service.ChatRealtimeService;
import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ChatRealtimeService chatRealtimeService;

    @GetMapping("/{ticketId}/chats")
    public ResponseEntity<List<ChatMessageResponse>> getTicketChats(@PathVariable Integer ticketId) {
        return ResponseEntity.ok(chatService.getTicketChats(ticketId));
    }

    @PostMapping("/{ticketId}/chats")
    public ResponseEntity<ChatMessageResponse> sendTicketChat(
            @PathVariable Integer ticketId,
            @RequestBody ChatMessageSendRequest request,
            Principal principal
    ) {
        if (request != null && request.getTicketId() != null && !ticketId.equals(request.getTicketId())) {
            throw new CustomException("ticketId trong payload không khớp với path.");
        }
        if (principal == null || principal.getName() == null) {
            throw new CustomException("Không xác định được người gửi.");
        }
        String content = request != null ? request.getContent() : null;
        ChatMessageResponse saved = chatService.saveTicketMessage(ticketId, content, principal.getName());
        chatRealtimeService.broadcastTicketMessage(ticketId, saved, principal.getName());
        return ResponseEntity.ok(saved);
    }
}
