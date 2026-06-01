package com.poly.mhv.dto.assetmap;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomShapeResponse {
    private Long id;
    private Integer floorId;
    private String floorName;
    private Integer locationId;
    private String roomName;
    private Boolean hasAsset;
    private List<String> cells;
    private String colorHex;
}
