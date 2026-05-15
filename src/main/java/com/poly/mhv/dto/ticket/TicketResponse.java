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
@Schema(name = "TicketResponse", description = "Thông tin ticket sau khi tạo, gán hoặc truy vấn")
public class TicketResponse {
    @Schema(description = "ID ticket", example = "15")
    private Integer id;

    @Schema(description = "Mã QA của thiết bị", example = "AT0007")
    private String assetQaCode;

    @Schema(description = "Tên thiết bị", example = "Máy chiếu Epson EB-X06")
    private String assetName;

    @Schema(description = "Phòng hiện tại của thiết bị", example = "Phòng 102")
    private String assetLocationName;

    @Schema(description = "Tên loại thiết bị", example = "Thiết bị âm thanh")
    private String assetCategoryName;

    @Schema(description = "ID loại kỹ thuật viên phụ trách", example = "3")
    private Integer assetCategoryTechTypeId;

    @Schema(description = "ID người báo hỏng", example = "12")
    private Integer reporterId;

    @Schema(description = "Tên người báo hỏng", example = "Nguyen Van A")
    private String reporterName;

    @Schema(description = "Vai trò người báo hỏng", example = "NhanVien")
    private String reporterRole;

    @Schema(description = "Số điện thoại người báo hỏng", example = "0987654321", nullable = true)
    private String reporterPhone;

    @Schema(description = "ID kỹ thuật viên đang được giao", example = "7", nullable = true)
    private Integer assigneeId;

    @Schema(description = "Tên kỹ thuật viên đang phụ trách", example = "Tran Thi B", nullable = true)
    private String assigneeName;

    @Schema(description = "Số điện thoại kỹ thuật viên đang phụ trách", example = "0912345678", nullable = true)
    private String assigneePhone;

    @Schema(description = "Mô tả sự cố", example = "Máy chiếu không lên nguồn, đèn báo đỏ liên tục.")
    private String description;

    @Schema(description = "Đường dẫn ảnh sự cố", example = "/uploads/tickets/ticket-15-error.jpg", nullable = true)
    private String imageUrl;

    @Schema(description = "Mức độ ưu tiên", example = "HIGH")
    private String priority;

    @Schema(description = "Trạng thái ticket", example = "IN_PROGRESS")
    private String status;

    @Schema(description = "Thời điểm tạo ticket theo UTC", example = "2026-05-15T08:30:00")
    private LocalDateTime createdAt;

    @Schema(description = "Hạn xử lý ticket theo UTC", example = "2026-05-16T08:30:00", nullable = true)
    private LocalDateTime dueDate;

    @Schema(description = "Thời điểm hoàn tất ticket theo UTC", example = "2026-05-15T10:05:00", nullable = true)
    private LocalDateTime resolvedAt;
}
