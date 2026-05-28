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

    @Schema(description = "Thời gian xử lý trung bình tính theo phút", example = "140")
    private long averageResolutionMinutes;

    @Schema(description = "Tỷ lệ tiếp nhận nhanh theo phần trăm", example = "90.0")
    private double fastResponseRate;

    @Schema(description = "Tỷ lệ hoàn tất đúng hạn theo phần trăm", example = "87.5")
    private double onTimeResolutionRate;

    @Schema(description = "Tỷ lệ tái lỗi theo phần trăm", example = "10.0")
    private double repeatIncidentRate;

    @Schema(description = "Tỷ lệ xử lý thành công lần đầu theo phần trăm", example = "90.0")
    private double firstTimeFixRate;

    @Schema(description = "Điểm hài lòng trung bình theo thang 1-5", example = "4.4")
    private double averageSatisfactionScore;

    @Schema(description = "Số ticket có dữ liệu hài lòng", example = "12")
    private long satisfactionSampleCount;

    @Schema(description = "Điểm KPI tổng hợp", example = "85.0")
    private double performanceScore;

    @Schema(description = "Xếp loại KPI", example = "Tốt")
    private String performanceGrade;
}
