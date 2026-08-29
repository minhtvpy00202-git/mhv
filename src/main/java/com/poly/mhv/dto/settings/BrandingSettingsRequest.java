package com.poly.mhv.dto.settings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
// DTO nhận dữ liệu branding từ frontend khi admin bấm lưu cấu hình.
public class BrandingSettingsRequest {

    // Tên viết tắt được dùng để ghép tiêu đề như "FPT Admin".
    @NotBlank(message = "Tên viết tắt là bắt buộc.")
    private String companyName;

    // Tên pháp lý đầy đủ của doanh nghiệp hoặc đơn vị vận hành.
    private String legalEntityName;

    // Mã số thuế hiển thị trong phần thông tin doanh nghiệp.
    private String taxCode;

    // Tên ứng dụng nghiệp vụ đi kèm tên viết tắt thương hiệu.
    @NotBlank(message = "Tên ứng dụng là bắt buộc.")
    private String appName;

    // Màu nhận diện chính của giao diện, bắt buộc ở dạng mã hex 6 ký tự.
    @NotBlank(message = "Màu sắc chủ đạo là bắt buộc.")
    @Pattern(regexp = "^#(?:[0-9A-Fa-f]{6})$", message = "Màu sắc chủ đạo phải có dạng #RRGGBB.")
    private String primaryColor;

    // Địa chỉ hiển thị trong phần thông tin liên hệ của hệ thống.
    private String address;

    // Số điện thoại liên hệ chính của đơn vị.
    private String phoneNumber;
}
