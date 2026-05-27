package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableReceiptLotResponse {
    private Long id;
    private String lotCode;
    private Integer quantityReceived;
    private Integer quantityRemaining;
    private BigDecimal unitPrice;
    private LocalDate receivedDate;
    private LocalDate expirationDate;
    private Integer supplierId;
    private String supplierName;
    private LocalDateTime receivedAt;
    private Integer receivedByUserId;
    private String receivedByUsername;
    private String receivedByFullName;
    private String note;
}
