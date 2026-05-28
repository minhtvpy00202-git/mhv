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

    @Schema(description = "Tỷ lệ ticket hoàn tất đúng hạn SLA theo phần trăm", example = "92.5")
    private double onTimeSlaRate;

    @Schema(description = "Số ticket hoàn tất đúng hạn SLA", example = "37")
    private long onTimeResolvedTicketCount;

    @Schema(description = "Tỷ lệ tài sản hoạt động tốt theo phần trăm", example = "96.0")
    private double healthyAssetRate;

    @Schema(description = "Số tài sản hoạt động tốt", example = "96")
    private long healthyAssetCount;

    @Schema(description = "Tổng số tài sản cố định", example = "100")
    private long totalAssetCount;

    @Schema(description = "Tỷ lệ tái lỗi theo phần trăm", example = "8.0")
    private double repeatIncidentRate;

    @Schema(description = "Số ticket tái lỗi", example = "4")
    private long repeatIncidentCount;

    @Schema(description = "Tỷ lệ vật tư dưới ngưỡng theo phần trăm", example = "12.5")
    private double lowStockConsumableRate;

    @Schema(description = "Số vật tư dưới ngưỡng", example = "3")
    private long lowStockConsumableCount;

    @Schema(description = "Tổng số mặt hàng vật tư", example = "24")
    private long totalConsumableCount;

    @Schema(description = "Tỷ lệ kiểm kê đúng hạn tạm tính theo phần trăm", example = "80.0")
    private double onTimeAuditRate;

    @Schema(description = "Số phiên kiểm kê hoàn tất đúng hạn", example = "8")
    private long onTimeAuditCount;

    @Schema(description = "Số phiên kiểm kê có hạn để đánh giá", example = "10")
    private long auditDueDateSampleCount;

    @Schema(description = "Tỷ lệ tiếp nhận nhanh theo phần trăm", example = "88.0")
    private double fastResponseRate;

    @Schema(description = "Số ticket được tiếp nhận nhanh", example = "22")
    private long fastResponseCount;

    @Schema(description = "Số ticket có đủ dữ liệu để tính tiếp nhận nhanh", example = "25")
    private long fastResponseSampleCount;

    @Schema(description = "Tỷ lệ hoàn tất đúng hạn của kỹ thuật viên theo phần trăm", example = "91.0")
    private double onTimeResolutionRate;

    @Schema(description = "Tỷ lệ xử lý thành công lần đầu theo phần trăm", example = "84.0")
    private double firstTimeFixRate;

    @Schema(description = "Số ticket xử lý thành công lần đầu", example = "21")
    private long firstTimeFixCount;

    @Schema(description = "Điểm hài lòng trung bình theo thang 1-5", example = "4.5")
    private double averageSatisfactionScore;

    @Schema(description = "Số ticket có dữ liệu hài lòng", example = "18")
    private long satisfactionSampleCount;

    @Schema(description = "Điểm KPI tổng hợp của kỹ thuật viên", example = "87.5")
    private double performanceScore;

    @Schema(description = "Xếp loại KPI của kỹ thuật viên", example = "Tốt")
    private String performanceGrade;

    @Schema(description = "Thống kê theo từng kỹ thuật viên")
    private List<TechnicianTicketKpiResponse> ticketsByTechnician;
}
