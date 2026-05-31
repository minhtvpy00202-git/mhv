package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpiredConsumableLotResponse {
    private Long lotId;
    private String assetQaCode;
    private String assetName;
    private String unit;
    private String lotCode;
    private Integer quantityRemaining;
    private BigDecimal unitPrice;
    private LocalDate receivedDate;
    private LocalDate expirationDate;
    private String supplierName;
    private long daysExpired;
    private boolean pendingDisposal;
}
