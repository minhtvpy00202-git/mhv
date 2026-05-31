package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.Valid;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableDisposalRequestCreateRequest {

    @NotBlank(message = "Lý do tiêu huỷ là bắt buộc.")
    private String reason;

    @Valid
    @NotEmpty(message = "Vui lòng chọn ít nhất một lô hàng để tiêu huỷ.")
    private List<ConsumableDisposalRequestItemCreateRequest> items;
}
