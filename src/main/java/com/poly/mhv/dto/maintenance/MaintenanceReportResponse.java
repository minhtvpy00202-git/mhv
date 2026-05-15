package com.poly.mhv.dto.maintenance;

import java.time.LocalDateTime;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "MaintenanceReportResponse", description = "Kết quả trả về sau khi tạo báo hỏng")
public class MaintenanceReportResponse {
    @Schema(description = "ID bản ghi báo hỏng", example = "31")
    private Integer id;

    @Schema(description = "Mã QA của thiết bị", example = "AT0007")
    private String assetQaCode;

    @Schema(description = "ID người gửi báo hỏng", example = "12")
    private Integer reportedBy;

    @Schema(description = "Mô tả hỏng hóc", example = "Loa bị rè, âm lượng lúc có lúc không.")
    private String description;

    @Schema(description = "Trạng thái bản ghi bảo trì", example = "PENDING")
    private String status;

    @Schema(description = "Thời điểm báo hỏng theo UTC", example = "2026-05-15T08:15:00")
    private LocalDateTime reportTime;
}
