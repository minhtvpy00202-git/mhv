package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryTransferRequest {
    @NotNull(message = "Vui lòng chọn người nhận xử lý.")
    @Positive(message = "Người nhận xử lý không hợp lệ.")
    private Integer assigneeUserId;
}
