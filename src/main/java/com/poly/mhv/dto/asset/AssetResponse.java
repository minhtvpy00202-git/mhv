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
public class AssetResponse {
    private String qaCode;
    private String trackingMode;
    private String name;
    private Integer categoryId;
    private String category;
    private String status;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private String specs;
    private BigDecimal purchasePrice;
    private LocalDate purchaseDate;
    private LocalDate warrantyExpirationDate;
    private Integer quantityOnHand;
    private Integer minimumStock;
    private String unit;
    private Integer supplierId;
    private String supplierName;
    private String supplierAddress;
    private String supplierPhoneNumber;
    private String qrCodeBase64;
}
