package com.poly.mhv.service;

import com.poly.mhv.dto.settings.BrandingSettingsRequest;
import com.poly.mhv.dto.settings.BrandingSettingsResponse;
import com.poly.mhv.entity.AppSetting;
import com.poly.mhv.repository.AppSettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class BrandingSettingsService {

    private static final String COMPANY_NAME_KEY = "branding.companyName";
    private static final String LEGAL_ENTITY_NAME_KEY = "branding.legalEntityName";
    private static final String TAX_CODE_KEY = "branding.taxCode";
    private static final String APP_NAME_KEY = "branding.appName";
    private static final String PRIMARY_COLOR_KEY = "branding.primaryColor";
    private static final String ADDRESS_KEY = "branding.address";
    private static final String PHONE_NUMBER_KEY = "branding.phoneNumber";

    private final AppSettingRepository appSettingRepository;
    private final String defaultCompanyName;
    private final String defaultLegalEntityName;
    private final String defaultTaxCode;
    private final String defaultAppName;
    private final String defaultPrimaryColor;
    private final String defaultAddress;
    private final String defaultPhoneNumber;

    public BrandingSettingsService(
            AppSettingRepository appSettingRepository,
            @Value("${app.branding.company-name:FPT}") String defaultCompanyName,
            @Value("${app.branding.legal-entity-name:}") String defaultLegalEntityName,
            @Value("${app.branding.tax-code:}") String defaultTaxCode,
            @Value("${app.branding.app-name:Asset Management}") String defaultAppName,
            @Value("${app.branding.primary-color:#f27025}") String defaultPrimaryColor,
            @Value("${app.branding.address:}") String defaultAddress,
            @Value("${app.branding.phone-number:}") String defaultPhoneNumber
    ) {
        this.appSettingRepository = appSettingRepository;
        this.defaultCompanyName = defaultCompanyName;
        this.defaultLegalEntityName = defaultLegalEntityName;
        this.defaultTaxCode = defaultTaxCode;
        this.defaultAppName = defaultAppName;
        this.defaultPrimaryColor = defaultPrimaryColor;
        this.defaultAddress = defaultAddress;
        this.defaultPhoneNumber = defaultPhoneNumber;
    }

    @Transactional(readOnly = true)
    public BrandingSettingsResponse getBrandingSettings() {
        String companyName = findSettingValue(COMPANY_NAME_KEY, defaultCompanyName);
        String legalEntityName = findSettingValue(LEGAL_ENTITY_NAME_KEY, defaultLegalEntityName);
        String taxCode = findSettingValue(TAX_CODE_KEY, defaultTaxCode);
        String appName = findSettingValue(APP_NAME_KEY, defaultAppName);
        String primaryColor = findSettingValue(PRIMARY_COLOR_KEY, defaultPrimaryColor);
        String address = findSettingValue(ADDRESS_KEY, defaultAddress);
        String phoneNumber = findSettingValue(PHONE_NUMBER_KEY, defaultPhoneNumber);
        return BrandingSettingsResponse.builder()
                .companyName(companyName)
                .legalEntityName(legalEntityName)
                .taxCode(taxCode)
                .appName(appName)
                .primaryColor(primaryColor)
                .address(address)
                .phoneNumber(phoneNumber)
                .adminTitle(companyName + " Admin")
                .techTitle(companyName + " Tech Support")
                .supplyTitle(companyName + " Vật tư tiêu hao")
                .build();
    }

    @Transactional
    public BrandingSettingsResponse updateBrandingSettings(BrandingSettingsRequest request) {
        saveSetting(COMPANY_NAME_KEY, request.getCompanyName());
        saveSetting(LEGAL_ENTITY_NAME_KEY, request.getLegalEntityName());
        saveSetting(TAX_CODE_KEY, request.getTaxCode());
        saveSetting(APP_NAME_KEY, request.getAppName());
        saveSetting(PRIMARY_COLOR_KEY, request.getPrimaryColor());
        saveSetting(ADDRESS_KEY, request.getAddress());
        saveSetting(PHONE_NUMBER_KEY, request.getPhoneNumber());
        return getBrandingSettings();
    }

    @Transactional(readOnly = true)
    public String getCompanyName() {
        return getBrandingSettings().getCompanyName();
    }

    @Transactional(readOnly = true)
    public String getAppName() {
        return getBrandingSettings().getAppName();
    }

    private String findSettingValue(String key, String fallbackValue) {
        return appSettingRepository.findById(key)
                .map(AppSetting::getSettingValue)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .orElse(fallbackValue);
    }

    private void saveSetting(String key, String value) {
        String normalizedValue = value == null ? "" : value.trim();
        appSettingRepository.save(
                AppSetting.builder()
                        .settingKey(key)
                        .settingValue(normalizedValue)
                        .build()
        );
    }
}
