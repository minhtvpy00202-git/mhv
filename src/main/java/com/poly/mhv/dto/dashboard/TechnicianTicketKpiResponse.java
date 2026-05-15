package com.poly.mhv.dto.dashboard;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TechnicianTicketKpiResponse", description = "KPI ticket của một kỹ thuật viên")
public class TechnicianTicketKpiResponse {
    @Schema(description = "ID kỹ thuật viên", example = "7")
    private Integer technicianId;

    @Schema(description = "Tên đăng nhập kỹ thuật viên", example = "techsup2")
    private String technicianUsername;

    @Schema(description = "Họ tên kỹ thuật viên", example = "Tran Thi B")
    private String technicianName;

    @Schema(description = "Tổng số ticket được giao", example = "16")
    private long assignedTicketCount;

    @Schema(description = "Số ticket đã xử lý", example = "10")
    private long resolvedTicketCount;

    @Schema(description = "Số ticket đang xử lý", example = "4")
    private long inProgressTicketCount;

    @Schema(description = "Số ticket quá hạn", example = "2")
    private long overdueTicketCount;

    @Schema(description = "Thời gian phản hồi đầu tiên trung bình tính theo phút", example = "18")
    private long averageFirstResponseMinutes;
}
