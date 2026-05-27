package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.NotBlank;
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
public class ConsumableRequestCreateRequest {

    @NotBlank(message = "Mã vật tư là bắt buộc.")
    private String assetQaCode;

    @NotNull(message = "Số lượng yêu cầu là bắt buộc.")
    @Positive(message = "Số lượng yêu cầu phải lớn hơn 0.")
    private Integer quantityRequested;

    @NotBlank(message = "Lý do cấp phát là bắt buộc.")
    @Size(max = 1000, message = "Lý do cấp phát không được vượt quá 1000 ký tự.")
    private String reason;
}
