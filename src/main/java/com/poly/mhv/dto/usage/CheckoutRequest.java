package com.poly.mhv.dto.usage;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckoutRequest {
    @NotBlank(message = "assetQaCode là bắt buộc.")
    private String assetQaCode;

    @NotNull(message = "userId là bắt buộc.")
    private Integer userId;

    @NotNull(message = "toLocationId là bắt buộc.")
    private Integer toLocationId;
}
