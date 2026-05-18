package com.poly.mhv.dto.ticket;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TicketAssignRequest", description = "Payload phân công hoặc tự nhận ticket")
public class TicketAssignRequest {
    @JsonAlias({"assigneeId", "assignee_id"})
    @Schema(description = "ID kỹ thuật viên được gán xử lý", example = "7")
    @NotNull(message = "Kỹ thuật viên được gán là bắt buộc.")
    @Positive(message = "Kỹ thuật viên được gán không hợp lệ.")
    private Integer assigneeId;
}
