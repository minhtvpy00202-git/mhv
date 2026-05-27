package com.poly.mhv.dto.asset;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableRequestResponse {
    private Long id;
    private String assetQaCode;
    private String assetName;
    private Integer locationId;
    private String locationName;
    private Integer quantityRequested;
    private String unit;
    private String reason;
    private String status;
    private String decisionNote;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private Integer requestedByUserId;
    private String requestedByUsername;
    private String requestedByFullName;
    private Integer resolvedByUserId;
    private String resolvedByUsername;
    private String resolvedByFullName;
}
