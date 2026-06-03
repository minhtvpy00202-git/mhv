package com.poly.mhv.dto.assetmapimport;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetMapImportApplyRequest {

    @NotEmpty(message = "Can chon it nhat mot ban ve con de tao so do.")
    private List<String> drawingIds;
}
