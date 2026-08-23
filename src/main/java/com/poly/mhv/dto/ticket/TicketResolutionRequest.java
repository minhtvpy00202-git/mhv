package com.poly.mhv.dto.ticket;

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
@Schema(name = "TicketResolutionRequest", description = "Kết quả hoàn tất xử lý ticket")
public class TicketResolutionRequest {

    @NotBlank(message = "Kết quả xử lý là bắt buộc.")
    @Pattern(
            regexp = "^(REPAIRED|NO_FAULT_FOUND|UNREPAIRABLE|REPLACEMENT_REQUIRED)$",
            message = "Kết quả xử lý không hợp lệ."
    )
    private String outcome;

    @NotBlank(message = "Ghi chú xử lý là bắt buộc.")
    @Size(min = 10, max = 1000, message = "Ghi chú xử lý phải từ 10 đến 1000 ký tự.")
    private String note;
}
