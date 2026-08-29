package com.poly.mhv.dto.inquiry;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryReportResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    private String targetRole;
    private Long totalRequests;
    private Long openRequests;
    private Long completedRequests;
    private Long rejectedRequests;
    private Long cancelledRequests;
    private Long respondedRequests;
    private Long responseSlaBreaches;
    private Long activeResponseOverdue;
    private Double averageFirstResponseMinutes;
    private Double responseSlaMetRate;
    private Double approvalRate;
    private Map<String, Long> statusCounts;
    private List<InquiryDemandSummaryResponse> topConsumableDemand;
    private OffsetDateTime generatedAt;
}
