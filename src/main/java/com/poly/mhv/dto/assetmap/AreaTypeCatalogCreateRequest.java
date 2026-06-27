package com.poly.mhv.dto.assetmap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaTypeCatalogCreateRequest {

    @NotBlank(message = "Ten loai khu vuc la bat buoc.")
    @Size(max = 120, message = "Ten loai khu vuc khong duoc vuot qua 120 ky tu.")
    private String label;

    @NotBlank(message = "Nhom khu vuc la bat buoc.")
    @Size(max = 120, message = "Ten nhom khu vuc khong duoc vuot qua 120 ky tu.")
    private String areaGroupLabel;

    @Size(max = 255, message = "Mo ta loai khu vuc khong duoc vuot qua 255 ky tu.")
    private String description;
}
