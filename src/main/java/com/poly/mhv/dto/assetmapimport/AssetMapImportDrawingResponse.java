package com.poly.mhv.dto.assetmapimport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetMapImportDrawingResponse {

    private String drawingId;

    private String title;

    private String previewUrl;

    private Double width;

    private Double height;
}
