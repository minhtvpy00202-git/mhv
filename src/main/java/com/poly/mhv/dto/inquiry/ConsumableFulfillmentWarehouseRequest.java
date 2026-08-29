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
public class ConsumableFulfillmentWarehouseRequest {
    @NotNull(message = "Vui lòng chọn kho xuất.")
    @Positive(message = "Kho xuất không hợp lệ.")
    private Integer warehouseLocationId;
}
