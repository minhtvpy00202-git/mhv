package com.poly.mhv.dto.inquiry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryMediaUploadResponse {
    private String mediaUrl;
    private String mediaType;
}
