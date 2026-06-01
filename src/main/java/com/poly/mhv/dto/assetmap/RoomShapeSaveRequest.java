package com.poly.mhv.dto.assetmap;

import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomShapeSaveRequest {
    private Long id;
    private Integer locationId;

    @Size(max = 100, message = "Ten phong khong duoc vuot qua 100 ky tu.")
    private String roomName;

    @Builder.Default
    private List<String> cells = List.of();

    @Size(max = 20, message = "Mau phong khong hop le.")
    private String colorHex;

    private Boolean hasAsset;
}
