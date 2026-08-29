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
public class InquiryReplyTemplateResponse {
    private Long id;
    private String ownerRole;
    private Integer createdByUserId;
    private String createdByName;
    private String title;
    private String content;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
