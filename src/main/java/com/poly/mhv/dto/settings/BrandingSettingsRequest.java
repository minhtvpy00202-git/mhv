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
public class BrandingSettingsRequest {

    @NotBlank(message = "Tên viết tắt là bắt buộc.")
    private String companyName;

    private String legalEntityName;

    private String taxCode;

    @NotBlank(message = "Tên ứng dụng là bắt buộc.")
    private String appName;

    @NotBlank(message = "Màu sắc chủ đạo là bắt buộc.")
    @Pattern(regexp = "^#(?:[0-9A-Fa-f]{6})$", message = "Màu sắc chủ đạo phải có dạng #RRGGBB.")
    private String primaryColor;

    private String address;

    private String phoneNumber;
}
