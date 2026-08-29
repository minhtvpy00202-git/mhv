package com.poly.mhv.dto.inquiry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryDemandSummaryResponse {
    private String assetQaCode;
    private String assetName;
    private String unit;
    private Long requestCount;
    private Long totalQuantityRequested;
}
