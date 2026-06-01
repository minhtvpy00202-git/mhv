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
public class MapFloorResponse {
    private Integer id;
    private String name;
    private Integer sortOrder;
    private Integer gridRows;
    private Integer gridCols;
    private String canvasBackgroundColor;
    private List<RoomShapeResponse> roomShapes;
}
