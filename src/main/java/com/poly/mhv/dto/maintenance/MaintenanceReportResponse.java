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
public class MaintenanceReportResponse {
    private Integer id;
    private String assetQaCode;
    private Integer reportedBy;
    private String description;
    private String status;
    private LocalDateTime reportTime;
}
