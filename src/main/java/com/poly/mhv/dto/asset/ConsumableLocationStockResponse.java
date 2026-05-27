package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableLocationStockResponse {
    private Long id;
    private String assetQaCode;
    private String assetName;
    private Integer categoryId;
    private String categoryName;
    private Integer locationId;
    private String locationName;
    private Integer quantityIssued;
    private Integer quantityRemaining;
    private Integer quantityConsumed;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal remainingValue;
    private LocalDateTime lastIssuedAt;
    private LocalDateTime lastUpdatedAt;
    private Integer lastUpdatedByUserId;
    private String lastUpdatedByUsername;
    private String lastUpdatedByFullName;
    private String lastNote;
}
