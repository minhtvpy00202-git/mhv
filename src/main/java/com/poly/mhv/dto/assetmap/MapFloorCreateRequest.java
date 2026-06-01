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
public class MapFloorCreateRequest {

    @NotBlank(message = "Ten tang la bat buoc.")
    @Size(max = 100, message = "Ten tang khong duoc vuot qua 100 ky tu.")
    private String name;

    @Min(value = 4, message = "So hang phai tu 4 tro len.")
    @Max(value = 100, message = "So hang khong duoc vuot qua 100.")
    @Builder.Default
    private Integer gridRows = 12;

    @Min(value = 4, message = "So cot phai tu 4 tro len.")
    @Max(value = 100, message = "So cot khong duoc vuot qua 100.")
    @Builder.Default
    private Integer gridCols = 20;

    @Size(max = 20, message = "Mau nen canvas khong hop le.")
    @Builder.Default
    private String canvasBackgroundColor = "#FFFFFF";

    private Integer sortOrder;
}
