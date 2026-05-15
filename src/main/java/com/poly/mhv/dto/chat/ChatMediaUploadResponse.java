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
@Schema(name = "ChatMediaUploadResponse", description = "Kết quả upload media chat để client dùng khi publish message realtime")
public class ChatMediaUploadResponse {
    @Schema(description = "Đường dẫn media đã lưu", example = "/uploads/chat/chat-media-15-20260515.jpg")
    private String mediaUrl;

    @Schema(description = "Loại media được nhận diện", example = "image", allowableValues = {"image", "audio"})
    private String mediaType;
}
