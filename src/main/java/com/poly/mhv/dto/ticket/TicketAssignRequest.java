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
@Schema(name = "TicketAssignRequest", description = "Payload phân công hoặc tự nhận ticket")
public class TicketAssignRequest {
    @JsonAlias({"assigneeId", "assignee_id"})
    @Schema(description = "ID kỹ thuật viên được gán xử lý", example = "7")
    private Integer assigneeId;
}
