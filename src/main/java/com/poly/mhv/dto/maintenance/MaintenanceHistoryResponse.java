package com.poly.mhv.dto.maintenance;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceHistoryResponse {
    private Integer id;
    private String assetQaCode;
    private String assetName;
    private String homeLocationName;
    private String currentLocationName;
    private String reporterFullName;
    private String description;
    private LocalDateTime reportTime;
    private String assetStatus;
}
