package com.poly.mhv.dto.ticket;

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
@Schema(name = "TicketTimelineEventResponse", description = "Một mốc sự kiện trong timeline của ticket")
public class TicketTimelineEventResponse {
    @Schema(description = "ID sự kiện timeline", example = "102")
    private Integer id;

    @Schema(description = "Loại sự kiện", example = "TICKET_ASSIGNED")
    private String eventType;

    @Schema(description = "ID người thực hiện sự kiện", example = "7", nullable = true)
    private Integer actorId;

    @Schema(description = "Tên người thực hiện sự kiện", example = "Tran Thi B")
    private String actorName;

    @Schema(description = "Thông điệp chính của sự kiện", example = "Gán kỹ thuật viên xử lý")
    private String message;

    @Schema(description = "Chi tiết bổ sung của sự kiện", example = "Kỹ thuật viên: Tran Thi B\nTrạng thái: Đang xử lý")
    private String detail;

    @Schema(description = "Thời điểm xảy ra sự kiện theo UTC", example = "2026-05-15T08:42:00")
    private LocalDateTime occurredAt;
}
