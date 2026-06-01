package com.poly.mhv.dto.assetmap;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
public class MapFloorUpdateRequest {

    @NotBlank(message = "Ten tang la bat buoc.")
    @Size(max = 100, message = "Ten tang khong duoc vuot qua 100 ky tu.")
    private String name;

    @Min(value = 4, message = "So hang phai tu 4 tro len.")
    @Max(value = 100, message = "So hang khong duoc vuot qua 100.")
    private Integer gridRows;

    @Min(value = 4, message = "So cot phai tu 4 tro len.")
    @Max(value = 100, message = "So cot khong duoc vuot qua 100.")
    private Integer gridCols;

    @Size(max = 20, message = "Mau nen canvas khong hop le.")
    private String canvasBackgroundColor;

    private Integer sortOrder;
}
