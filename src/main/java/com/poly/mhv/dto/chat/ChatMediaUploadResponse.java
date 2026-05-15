package com.poly.mhv.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMediaUploadResponse {
    private String mediaUrl;
    private String mediaType;
}
