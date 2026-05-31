package com.poly.mhv.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BrandingSettingsResponse {
    private String companyName;
    private String legalEntityName;
    private String taxCode;
    private String appName;
    private String primaryColor;
    private String address;
    private String phoneNumber;
    private String adminTitle;
    private String techTitle;
    private String supplyTitle;
}
