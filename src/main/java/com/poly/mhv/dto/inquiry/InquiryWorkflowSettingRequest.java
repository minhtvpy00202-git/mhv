package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryWorkflowSettingRequest {

    @NotNull @Min(5) @Max(1440)
    private Integer assetResponseSlaMinutes;

    @NotNull @Min(5) @Max(1440)
    private Integer consumableResponseSlaMinutes;

    @NotNull @Min(1) @Max(168)
    private Integer overdueReminderIntervalHours;

    @NotNull @Min(1) @Max(1000000)
    private Integer largeQuantityThreshold;

    @NotNull @DecimalMin(value = "0.00")
    private BigDecimal highValueThreshold;
}
