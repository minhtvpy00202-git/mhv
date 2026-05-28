package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetResponse {
    private String qaCode;
    private String trackingMode;
    private String name;
    private Integer categoryId;
    private String category;
    private String status;
    private String technicalStatus;
    private String usageStatus;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private String specs;
    private BigDecimal purchasePrice;
    private LocalDate purchaseDate;
    private LocalDate warrantyExpirationDate;
    private Boolean expiryTrackingEnabled;
    private LocalDate expirationDate;
    private Integer quantityOnHand;
    private Integer minimumStock;
    private String unit;
    private Integer supplierId;
    private String supplierName;
    private String supplierAddress;
    private String supplierPhoneNumber;
    private List<ConsumableReceiptLotResponse> receiptLots;
    private String qrCodeBase64;
}
