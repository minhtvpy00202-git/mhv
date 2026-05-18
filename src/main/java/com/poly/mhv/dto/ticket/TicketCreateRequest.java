package com.poly.mhv.dto.ticket;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @NotBlank(message = "Mã QA thiết bị là bắt buộc.")
    @Size(max = 20, message = "Mã QA thiết bị không được vượt quá 20 ký tự.")
    private String assetQaCode;

    @Schema(description = "Mô tả chi tiết sự cố", example = "Máy chiếu không lên nguồn, đèn báo đỏ liên tục.")
    @NotBlank(message = "Mô tả sự cố là bắt buộc.")
    @Size(min = 10, max = 1000, message = "Mô tả sự cố phải từ 10 đến 1000 ký tự.")
    private String description;

    @Schema(description = "Mức độ ưu tiên", example = "HIGH", allowableValues = {"LOW", "MEDIUM", "HIGH"})
    @NotBlank(message = "Mức độ ưu tiên là bắt buộc.")
    @Pattern(regexp = "^(LOW|MEDIUM|HIGH)$", message = "Mức độ ưu tiên không hợp lệ.")
    private String priority;

    @JsonAlias({"imageUrl", "image_url"})
    @Schema(
            description = "URL ảnh lỗi theo cách cũ. Giữ để tương thích cũ, khuyến nghị dùng API multipart với field image.",
            example = "/uploads/tickets/ticket-15-error.jpg",
            nullable = true
    )
    @Size(max = 255, message = "Đường dẫn ảnh không được vượt quá 255 ký tự.")
    private String imageUrl;
}
