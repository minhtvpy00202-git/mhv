package com.poly.mhv.dto.assetmapimport;

import com.poly.mhv.dto.assetmap.MapFloorResponse;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportFloorResponse {
    private Long id;
    private String sourceFloorKey;
    private String suggestedName;
    private String friendlyLabel;
    private String drawingType;
    private Integer pageNumber;
    private Integer sortOrder;
    private Integer widthPx;
    private Integer heightPx;
    private String scaleHint;
    private String backgroundImageUrl;
    private String previewBoundsJson;
    private Double detectionConfidence;
    private Boolean selectedForAnalysis;
    private String parseStatus;
    private Integer sourceImageWidthPx;
    private Integer sourceImageHeightPx;
    private Integer suggestedTargetFloorId;
    private List<MapFloorResponse> availableTargetFloors;
    private List<MapImportSuggestionResponse> suggestions;
}
