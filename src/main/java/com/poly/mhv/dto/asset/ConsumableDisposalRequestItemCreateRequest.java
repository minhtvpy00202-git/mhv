package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableDisposalRequestItemCreateRequest {

    @NotNull(message = "Lô hàng cần tiêu huỷ là bắt buộc.")
    private Long receiptLotId;

    @NotNull(message = "Số lượng tiêu huỷ là bắt buộc.")
    @Positive(message = "Số lượng tiêu huỷ phải lớn hơn 0.")
    private Integer quantityRequested;
}
