package com.poly.mhv.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TicketExtensionRequest", description = "Payload yêu cầu gia hạn thời gian xử lý ticket")
public class TicketExtensionRequest {

    @NotNull(message = "Số phút xin gia hạn là bắt buộc.")
    @Min(value = 1, message = "Số phút xin gia hạn phải tối thiểu là 1 phút.")
    @Schema(description = "Số phút xin gia hạn thêm", example = "60")
    private Integer requestedMinutes;

    @NotBlank(message = "Lý do xin gia hạn là bắt buộc.")
    @Size(min = 10, max = 500, message = "Lý do xin gia hạn phải từ 10 đến 500 ký tự.")
    @Schema(description = "Lý do gia hạn", example = "Lỗi chập nguồn phức tạp, cần kiểm tra bo mạch bên trong.")
    private String reason;
}
