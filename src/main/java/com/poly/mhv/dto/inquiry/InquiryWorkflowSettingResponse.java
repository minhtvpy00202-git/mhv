package com.poly.mhv.dto.inquiry;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryWorkflowSettingResponse {
    private Integer assetResponseSlaMinutes;
    private Integer consumableResponseSlaMinutes;
    private Integer overdueReminderIntervalHours;
    private Integer largeQuantityThreshold;
    private BigDecimal highValueThreshold;
    private Integer updatedByUserId;
    private String updatedByName;
    private OffsetDateTime updatedAt;
}
