package com.poly.mhv.dto.ticket;

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
@Schema(name = "TicketCreateRequest", description = "Payload tạo ticket báo hỏng thiết bị")
public class TicketCreateRequest {
    @JsonAlias({"assetQaCode", "asset_qa_code"})
    @Schema(description = "Mã QA của thiết bị bị hỏng", example = "AT0007")
    private String assetQaCode;

    @Schema(description = "Mô tả chi tiết sự cố", example = "Máy chiếu không lên nguồn, đèn báo đỏ liên tục.")
    private String description;

    @Schema(description = "Mức độ ưu tiên", example = "HIGH", allowableValues = {"LOW", "MEDIUM", "HIGH"})
    private String priority;

    @JsonAlias({"imageUrl", "image_url"})
    @Schema(
            description = "URL ảnh lỗi theo cách cũ. Giữ để tương thích cũ, khuyến nghị dùng API multipart với field image.",
            example = "/uploads/tickets/ticket-15-error.jpg",
            nullable = true
    )
    private String imageUrl;
}
