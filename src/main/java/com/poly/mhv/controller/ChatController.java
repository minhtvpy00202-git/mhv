package com.poly.mhv.controller;

import com.poly.mhv.dto.chat.ChatMessageResponse;
import com.poly.mhv.dto.chat.ChatMessageSendRequest;
import com.poly.mhv.dto.chat.ChatMediaUploadResponse;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ChatService;
import com.poly.mhv.service.ChatRealtimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/tickets", "/tickets"})
@RequiredArgsConstructor
@Tag(name = "Trao đổi ticket", description = "API lấy lịch sử chat và gửi tin nhắn trong ticket")
@SecurityRequirement(name = "bearerAuth")
public class ChatController {

    private final ChatService chatService;
    private final ChatRealtimeService chatRealtimeService;

    @GetMapping("/{ticketId}/chats")
    @Operation(summary = "Lấy lịch sử chat của ticket", description = "Lấy danh sách tin nhắn trao đổi trong một ticket.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử chat thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket")
    })
    public ResponseEntity<List<ChatMessageResponse>> getTicketChats(
            @PathVariable Integer ticketId,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return ResponseEntity.ok(chatService.getTicketChats(ticketId, limit));
    }

    @PostMapping("/{ticketId}/chats")
    @Operation(summary = "Gửi tin nhắn cho ticket", description = "Gửi một tin nhắn mới vào luồng trao đổi của ticket. API này dùng làm fallback cho client không có realtime.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Gửi tin nhắn thành công"),
            @ApiResponse(responseCode = "400", description = "Payload không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket")
    })
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
        ChatMessageResponse saved = chatService.saveTicketMessage(ticketId, request, principal.getName());
        chatRealtimeService.broadcastTicketMessage(ticketId, saved, principal.getName());
        return ResponseEntity.ok(saved);
    }

    @PostMapping(path = "/{ticketId}/chats/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload media chat", description = "Upload ảnh hoặc ghi âm cho ticket, trả về mediaUrl để client publish qua realtime.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Upload media thành công"),
            @ApiResponse(responseCode = "400", description = "File media không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy ticket")
    })
    public ResponseEntity<ChatMediaUploadResponse> uploadChatMedia(
            @PathVariable Integer ticketId,
            @RequestPart("file") MultipartFile file,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new CustomException("Không xác định được người gửi.");
        }
        return ResponseEntity.ok(chatService.uploadTicketMedia(ticketId, file, principal.getName()));
    }
}
