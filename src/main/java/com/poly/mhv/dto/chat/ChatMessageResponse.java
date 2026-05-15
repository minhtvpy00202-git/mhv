package com.poly.mhv.dto.chat;

import java.time.OffsetDateTime;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "ChatMessageResponse", description = "Dữ liệu một tin nhắn trong luồng trao đổi ticket")
public class ChatMessageResponse {
    @Schema(description = "ID tin nhắn", example = "225")
    private Integer id;

    @Schema(description = "ID ticket chứa tin nhắn", example = "15")
    private Integer ticketId;

    @Schema(description = "ID người gửi", example = "7")
    private Integer senderId;

    @Schema(description = "Nội dung tin nhắn", example = "Em đã kiểm tra sơ bộ, đang thay dây nguồn.", nullable = true)
    private String content;

    @Schema(description = "Đường dẫn media đính kèm", example = "/uploads/chat/chat-media-15-20260515.jpg", nullable = true)
    private String mediaUrl;

    @Schema(description = "Loại media", example = "image", nullable = true)
    private String mediaType;

    @Schema(description = "Thời gian tạo tin nhắn kèm offset giờ Việt Nam", example = "2026-05-15T15:45:00+07:00")
    private OffsetDateTime createdAt;
}
