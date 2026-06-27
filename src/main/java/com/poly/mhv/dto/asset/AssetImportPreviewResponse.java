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
public class AssetImportPreviewResponse {
    private int totalRows;
    private int validRows;
    private int errorRows;
    private List<AssetImportPreviewRow> rows;
}
