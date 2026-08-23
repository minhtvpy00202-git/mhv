package com.poly.mhv.dto.inquiry;

import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryMessageResponse {
    private Long id;
    private Long inquiryId;
    private Integer senderId;
    private String senderName;
    private String senderRole;
    private String content;
    private String mediaUrl;
    private String mediaType;
    private OffsetDateTime createdAt;
    private OffsetDateTime readAt;
}
