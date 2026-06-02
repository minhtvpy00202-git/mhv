package com.poly.mhv.dto.assetmapimport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportSuggestionUpdateRequest {
    private String labelText;
    private String normalizedName;
    private String suggestionType;
    private String colorHex;
    private String polygonJson;
    private Boolean hasAssetSuggested;
    private String reviewStatus;
    private String notes;
}
