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
public class InquiryCreateRequest {

    @NotBlank(message = "Vui lòng chọn thiết bị hoặc vật tư.")
    private String assetQaCode;

    @NotNull(message = "Vui lòng chọn phòng sử dụng hoặc phòng nhận.")
    @Positive(message = "Phòng sử dụng không hợp lệ.")
    private Integer destinationLocationId;

    @Positive(message = "Số lượng yêu cầu phải lớn hơn 0.")
    private Integer quantityRequested;

    @NotNull(message = "Vui lòng chọn ngày cần sử dụng.")
    @FutureOrPresent(message = "Ngày cần sử dụng không được ở trong quá khứ.")
    private LocalDate neededFrom;

    private LocalDate expectedReturnDate;

    @NotBlank(message = "Vui lòng nhập mục đích sử dụng.")
    @Size(max = 1000, message = "Mục đích sử dụng không được vượt quá 1000 ký tự.")
    private String purpose;

    @Size(max = 4000, message = "Tin nhắn mở đầu không được vượt quá 4000 ký tự.")
    private String message;
}
