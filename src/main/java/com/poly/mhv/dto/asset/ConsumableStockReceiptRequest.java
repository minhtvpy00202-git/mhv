package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableStockReceiptRequest {

    @NotNull(message = "Số lượng nhập là bắt buộc.")
    @Positive(message = "Số lượng nhập phải lớn hơn 0.")
    private Integer quantity;

    @NotNull(message = "Đơn giá nhập là bắt buộc.")
    @DecimalMin(value = "0.01", message = "Đơn giá nhập phải lớn hơn 0.")
    private BigDecimal unitPrice;

    @NotNull(message = "Nhà cung cấp là bắt buộc.")
    @Positive(message = "Nhà cung cấp không hợp lệ.")
    private Integer supplierId;
}
