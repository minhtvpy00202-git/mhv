package com.poly.mhv.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
// DTO trả toàn bộ cấu hình branding hiện tại từ backend về cho frontend.
public class BrandingSettingsResponse {
    // Tên viết tắt thương hiệu.
    private String companyName;
    // Tên pháp lý đầy đủ của doanh nghiệp.
    private String legalEntityName;
    // Mã số thuế doanh nghiệp.
    private String taxCode;
    // Tên ứng dụng đang hiển thị.
    private String appName;
    // Màu chủ đạo của giao diện.
    private String primaryColor;
    // Địa chỉ liên hệ.
    private String address;
    // Số điện thoại liên hệ.
    private String phoneNumber;
    // Tiêu đề hiển thị sẵn cho khu vực admin.
    private String adminTitle;
    // Tiêu đề hiển thị sẵn cho khu vực kỹ thuật.
    private String techTitle;
    // Tiêu đề hiển thị sẵn cho khu vực vật tư tiêu hao.
    private String supplyTitle;
}
