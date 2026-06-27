package com.poly.mhv.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "TicketExtensionReviewRequest", description = "Payload phê duyệt hoặc từ chối yêu cầu gia hạn")
public class TicketExtensionReviewRequest {

    @NotBlank(message = "Quyết định là bắt buộc.")
    @Pattern(regexp = "^(APPROVED|REJECTED)$", message = "Quyết định không hợp lệ. Chỉ chấp nhận APPROVED hoặc REJECTED.")
    @Schema(description = "Quyết định duyệt hay từ chối", example = "APPROVED", allowableValues = {"APPROVED", "REJECTED"})
    private String decision;

    @Size(max = 255, message = "Lý do từ chối không được vượt quá 255 ký tự.")
    @Schema(description = "Lý do từ chối (chỉ cần thiết nếu decision là REJECTED)", example = "Độ ưu tiên cao không được trễ quá lâu.")
    private String rejectReason;
}
