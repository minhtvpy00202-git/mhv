package com.poly.mhv.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TicketReasonRequest", description = "Lý do thay đổi vòng đời ticket")
public class TicketReasonRequest {

    @NotBlank(message = "Lý do là bắt buộc.")
    @Size(min = 10, max = 1000, message = "Lý do phải từ 10 đến 1000 ký tự.")
    private String reason;
}
