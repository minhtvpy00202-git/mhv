package com.poly.mhv.dto.asset;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableDisposalRequestResponse {
    private Long id;
    private String assetQaCode;
    private String assetName;
    private String unit;
    private Long receiptLotId;
    private String lotCode;
    private Integer quantityRequested;
    private LocalDate receivedDate;
    private LocalDate expirationDate;
    private String supplierName;
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
    private Integer itemCount;
    private List<ConsumableDisposalRequestItemResponse> items;
}
