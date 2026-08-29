package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.NotNull;
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
public class InquiryConsumableConversionRequest {

    @NotNull(message = "Vui lòng chọn kho xuất.")
    @Positive(message = "Kho xuất không hợp lệ.")
    private Integer sourceWarehouseLocationId;

    @Size(max = 2000, message = "Ghi chú không được vượt quá 2000 ký tự.")
    private String note;
}
