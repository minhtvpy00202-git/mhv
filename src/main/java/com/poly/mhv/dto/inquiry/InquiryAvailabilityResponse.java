package com.poly.mhv.dto.inquiry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryAvailabilityResponse {
    private String assetQaCode;
    private String assetName;
    private String trackingMode;
    private Integer categoryId;
    private String categoryName;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private String availabilityCode;
    private String availabilityLabel;
    private Boolean available;
    private Integer availableQuantity;
    private String unit;
    private String retailUnit;
    private String wholesaleUnit;
    private Integer wholesaleToRetailFactor;
    private String formattedAvailableQuantity;
    private String formattedAvailableQuantityRetailOnly;
}
