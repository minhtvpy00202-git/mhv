package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableWarehouseTransferRequest {

    @NotNull(message = "Kho nguồn là bắt buộc.")
    @Positive(message = "Kho nguồn không hợp lệ.")
    private Integer sourceWarehouseLocationId;

    @NotNull(message = "Kho đích là bắt buộc.")
    @Positive(message = "Kho đích không hợp lệ.")
    private Integer targetWarehouseLocationId;

    @NotNull(message = "Số lượng chuyển là bắt buộc.")
    @Positive(message = "Số lượng chuyển phải lớn hơn 0.")
    private Integer quantity;

    @Size(max = 1000, message = "Ghi chú chuyển kho không được vượt quá 1000 ký tự.")
    private String note;
}
