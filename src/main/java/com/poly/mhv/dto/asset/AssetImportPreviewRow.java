package com.poly.mhv.dto.asset;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetImportPreviewRow {
    private int rowNumber;
    private String trackingMode;
    private String name;
    private String categoryName;
    private String locationName;
    private boolean valid;
    private List<String> errors;
}
