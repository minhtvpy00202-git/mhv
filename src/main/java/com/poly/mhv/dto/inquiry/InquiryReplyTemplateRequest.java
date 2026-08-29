package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryReplyTemplateRequest {

    @NotBlank(message = "Tên mẫu trả lời là bắt buộc.")
    @Size(max = 100, message = "Tên mẫu không được vượt quá 100 ký tự.")
    private String title;

    @NotBlank(message = "Nội dung mẫu trả lời là bắt buộc.")
    @Size(max = 4000, message = "Nội dung mẫu không được vượt quá 4000 ký tự.")
    private String content;
}
