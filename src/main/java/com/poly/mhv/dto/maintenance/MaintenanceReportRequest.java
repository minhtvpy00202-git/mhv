package com.poly.mhv.dto.maintenance;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "MaintenanceReportRequest", description = "Payload báo hỏng thiết bị")
public class MaintenanceReportRequest {
    @JsonAlias({"assetQaCode", "asset_qa_code"})
    @Schema(description = "Mã QA của thiết bị cần báo hỏng", example = "AT0007")
    private String assetQaCode;

    @Schema(description = "Mô tả lỗi hoặc triệu chứng hỏng hóc", example = "Loa bị rè, âm lượng lúc có lúc không.")
    private String description;

    @Schema(description = "Mức độ ưu tiên", example = "MEDIUM", allowableValues = {"LOW", "MEDIUM", "HIGH"}, nullable = true)
    private String priority;

    @JsonAlias({"imageUrl", "image_url"})
    @Schema(
            description = "URL ảnh lỗi theo cách cũ. Giữ để tương thích, khuyến nghị dùng API multipart với field image.",
            example = "/uploads/maintenance/maintenance-15-error.jpg",
            nullable = true
    )
    private String imageUrl;
}
