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
public class AreaTypeCatalogUpdateRequest {

    @NotBlank(message = "Ten loai khu vuc la bat buoc.")
    @Size(max = 120, message = "Ten loai khu vuc khong duoc vuot qua 120 ky tu.")
    private String label;

    @Size(max = 255, message = "Mo ta loai khu vuc khong duoc vuot qua 255 ky tu.")
    private String description;

    private Boolean defaultHasAsset;
}
