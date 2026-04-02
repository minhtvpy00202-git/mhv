package com.poly.mhv.controller;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.service.ChatService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/{ticketId}/chats")
    public ResponseEntity<List<ChatMessageResponse>> getTicketChats(@PathVariable Integer ticketId) {
        return ResponseEntity.ok(chatService.getTicketChats(ticketId));
    }
}
