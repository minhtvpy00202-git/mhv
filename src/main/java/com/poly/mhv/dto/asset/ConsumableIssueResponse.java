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
public class ConsumableIssueResponse {
    private Long id;
    private String assetQaCode;
    private String assetName;
    private Integer issuedToLocationId;
    private String issuedToLocationName;
    private Integer quantity;
    private String unit;
    private BigDecimal unitPrice;
    private String note;
    private Integer issuedByUserId;
    private String issuedByUsername;
    private String issuedByFullName;
    private LocalDateTime issuedAt;
}
