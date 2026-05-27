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
public class ConsumableIssueRequest {

    @NotNull(message = "Phòng nhận là bắt buộc.")
    @Positive(message = "Phòng nhận không hợp lệ.")
    private Integer issuedToLocationId;

    @NotNull(message = "Số lượng cấp phát là bắt buộc.")
    @Positive(message = "Số lượng cấp phát phải lớn hơn 0.")
    private Integer quantity;

    @Size(max = 1000, message = "Ghi chú không được vượt quá 1000 ký tự.")
    private String note;
}
