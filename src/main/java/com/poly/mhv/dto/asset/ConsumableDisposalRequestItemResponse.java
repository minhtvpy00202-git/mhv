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
public class ConsumableDisposalRequestItemResponse {
    private Long id;
    private Long receiptLotId;
    private String lotCode;
    private Integer quantityRequested;
    private Integer quantityRemainingAtRequest;
    private LocalDate receivedDate;
    private LocalDate expirationDate;
    private BigDecimal unitPrice;
    private String supplierName;
}
