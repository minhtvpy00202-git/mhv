package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableLocationRemainingUpdateRequest {

    @NotNull(message = "Số lượng còn lại là bắt buộc.")
    @Min(value = 0, message = "Số lượng còn lại không được âm.")
    private Integer quantityRemaining;

    @Size(max = 1000, message = "Ghi chú không được vượt quá 1000 ký tự.")
    private String note;
}
