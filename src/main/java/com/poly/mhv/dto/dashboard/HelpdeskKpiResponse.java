package com.poly.mhv.dto.dashboard;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "HelpdeskKpiResponse", description = "Tổng hợp KPI helpdesk cho admin hoặc kỹ thuật viên")
public class HelpdeskKpiResponse {
    @Schema(description = "Phạm vi KPI", example = "ADMIN")
    private String scope;

    @Schema(description = "ID kỹ thuật viên nếu là KPI cá nhân", example = "7", nullable = true)
    private Integer technicianId;

    @Schema(description = "Tên kỹ thuật viên nếu là KPI cá nhân", example = "Tran Thi B", nullable = true)
    private String technicianName;

    @Schema(description = "Số ticket mới", example = "12")
    private long newTicketCount;

    @Schema(description = "Số ticket đã xử lý", example = "45")
    private long resolvedTicketCount;

    @Schema(description = "Số ticket đang xử lý", example = "8")
    private long inProgressTicketCount;

    @Schema(description = "Số ticket quá hạn SLA", example = "3")
    private long overdueTicketCount;

    @Schema(description = "Số ticket chưa hoàn tất", example = "20")
    private long activeTicketCount;

    @Schema(description = "Tỷ lệ ticket quá hạn SLA theo phần trăm", example = "15.0")
    private double overdueSlaRate;

    @Schema(description = "Thời gian xử lý trung bình tính theo phút", example = "185")
    private long averageResolutionMinutes;

    @Schema(description = "Thời gian phản hồi đầu tiên trung bình tính theo phút", example = "27")
    private long averageFirstResponseMinutes;

    @Schema(description = "Thống kê theo từng kỹ thuật viên")
    private List<TechnicianTicketKpiResponse> ticketsByTechnician;
}
