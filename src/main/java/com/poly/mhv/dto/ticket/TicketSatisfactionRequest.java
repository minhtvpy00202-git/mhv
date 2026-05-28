package com.poly.mhv.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TicketSatisfactionRequest", description = "Payload chấm điểm hài lòng sau khi ticket đã hoàn tất")
public class TicketSatisfactionRequest {
    @Schema(description = "Điểm hài lòng từ 1 đến 5", example = "4")
    @NotNull(message = "satisfactionScore là bắt buộc.")
    @Min(value = 1, message = "Điểm hài lòng phải từ 1 đến 5.")
    @Max(value = 5, message = "Điểm hài lòng phải từ 1 đến 5.")
    private Integer satisfactionScore;
}
