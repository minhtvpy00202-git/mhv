package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BorrowRequestDecisionRequest {
    @Size(max = 2000, message = "Ghi chú không được vượt quá 2000 ký tự.")
    private String note;

    @Positive(message = "Thời gian giữ chỗ phải lớn hơn 0.")
    private Integer reservationMinutes;
}
