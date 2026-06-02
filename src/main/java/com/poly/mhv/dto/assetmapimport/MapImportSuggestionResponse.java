package com.poly.mhv.dto.assetmapimport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportSuggestionResponse {
    private Long id;
    private String suggestionType;
    private String labelText;
    private String normalizedName;
    private String cellsJson;
    private String polygonJson;
    private String colorHex;
    private Boolean hasAssetSuggested;
    private Double confidenceScore;
    private String sourceMethod;
    private String reviewStatus;
    private Integer linkedLocationId;
    private String notes;
}
