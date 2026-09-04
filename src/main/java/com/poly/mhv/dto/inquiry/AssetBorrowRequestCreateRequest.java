package com.poly.mhv.dto.inquiry;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetBorrowRequestCreateRequest {

    @NotBlank(message = "Vui lòng chọn thiết bị.")
    private String assetQaCode;

    @NotNull(message = "Vui lòng chọn phòng sử dụng.")
    @Positive(message = "Phòng sử dụng không hợp lệ.")
    private Integer destinationLocationId;

    @NotNull(message = "Vui lòng chọn ngày bắt đầu mượn.")
    @FutureOrPresent(message = "Ngày bắt đầu mượn không được ở trong quá khứ.")
    private LocalDate neededFrom;

    @NotNull(message = "Vui lòng chọn ngày hẹn trả.")
    @FutureOrPresent(message = "Ngày hẹn trả không được ở trong quá khứ.")
    private LocalDate expectedReturnDate;

    @NotBlank(message = "Vui lòng nhập mục đích sử dụng.")
    @Size(max = 1000, message = "Mục đích sử dụng không được vượt quá 1000 ký tự.")
    private String purpose;
}
