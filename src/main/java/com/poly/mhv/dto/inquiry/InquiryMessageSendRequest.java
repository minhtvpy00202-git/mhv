package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryMessageSendRequest {

    @Size(max = 4000, message = "Tin nhắn không được vượt quá 4000 ký tự.")
    private String content;

    @Size(max = 1000, message = "Đường dẫn media không hợp lệ.")
    private String mediaUrl;

    @Size(max = 20, message = "Loại media không hợp lệ.")
    private String mediaType;
}
