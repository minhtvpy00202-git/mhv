package com.poly.mhv.dto.assetmap;

import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FloorLayoutSaveRequest {

    @Valid
    @Builder.Default
    private List<RoomShapeSaveRequest> roomShapes = new ArrayList<>();
}
