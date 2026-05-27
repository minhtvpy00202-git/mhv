package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableRequestDecisionRequest {

    @Size(max = 1000, message = "Ghi chú xử lý không được vượt quá 1000 ký tự.")
    private String note;
}
