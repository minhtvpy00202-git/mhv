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
public class ConsumableWarehouseTransferResponse {
    private Long id;
    private String assetQaCode;
    private String assetName;
    private Integer sourceWarehouseLocationId;
    private String sourceWarehouseLocationName;
    private Integer targetWarehouseLocationId;
    private String targetWarehouseLocationName;
    private Integer quantityTransferred;
    private String unit;
    private BigDecimal unitPrice;
    private LocalDateTime transferredAt;
    private Integer transferredByUserId;
    private String transferredByUsername;
    private String transferredByFullName;
    private String note;
}
