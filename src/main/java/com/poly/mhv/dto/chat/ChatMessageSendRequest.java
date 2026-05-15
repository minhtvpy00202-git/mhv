package com.poly.mhv.dto.chat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "ChatMessageSendRequest", description = "Payload gửi tin nhắn hoặc media vào ticket")
public class ChatMessageSendRequest {
    @Schema(description = "ID ticket, nên trùng với ticketId trên path", example = "15", nullable = true)
    private Integer ticketId;

    @Schema(description = "Nội dung tin nhắn văn bản", example = "Em đã kiểm tra sơ bộ, đang thay dây nguồn.", nullable = true)
    private String content;

    @Schema(description = "Đường dẫn media đã upload trước đó", example = "/uploads/chat/chat-media-15-20260515.jpg", nullable = true)
    private String mediaUrl;

    @Schema(description = "Loại media của mediaUrl", example = "image", allowableValues = {"image", "audio"}, nullable = true)
    private String mediaType;
}
