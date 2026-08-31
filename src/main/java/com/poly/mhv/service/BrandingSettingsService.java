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

    // Các key dùng để lưu branding trong bảng app_settings thay vì hard-code trong nhiều nơi.
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

    // Tiêm repository và các giá trị mặc định từ application properties để làm fallback khi DB chưa có cấu hình.
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
    // Ghép cấu hình branding hiện tại từ app_settings và giá trị mặc định để trả về cho frontend.
    public BrandingSettingsResponse getBrandingSettings() {
        // Mỗi trường được đọc riêng theo key để dễ mở rộng thêm cấu hình mới sau này.
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
    // Lưu toàn bộ cấu hình branding mới xuống app_settings rồi trả lại trạng thái mới nhất cho frontend.
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
    // Hàm tiện ích cho các nơi chỉ cần tên viết tắt doanh nghiệp.
    public String getCompanyName() {
        return getBrandingSettings().getCompanyName();
    }

    @Transactional(readOnly = true)
    // Hàm tiện ích cho các nơi chỉ cần tên ứng dụng đang được cấu hình.
    public String getAppName() {
        return getBrandingSettings().getAppName();
    }

    // Tìm giá trị theo key trong app_settings và fallback về cấu hình mặc định nếu DB chưa có hoặc giá trị rỗng.
    private String findSettingValue(String key, String fallbackValue) {
        return appSettingRepository.findById(key)
                .map(AppSetting::getSettingValue)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .orElse(fallbackValue);
    }

    // Chuẩn hóa giá trị trước khi lưu để tránh null và khoảng trắng dư trong database.
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
