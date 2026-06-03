package com.poly.mhv.dto.assetmapimport;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetMapImportAnalyzeResponse {

    private String sessionId;

    private String sourceFileName;

    private String sourceFileType;

    private List<AssetMapImportDrawingResponse> drawings;
}
