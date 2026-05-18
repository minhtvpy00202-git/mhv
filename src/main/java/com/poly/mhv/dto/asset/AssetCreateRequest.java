package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetCreateRequest {
    @NotBlank(message = "Tên thiết bị là bắt buộc.")
    @Size(min = 2, max = 150, message = "Tên thiết bị phải từ 2 đến 150 ký tự.")
    private String name;

    @NotNull(message = "Loại thiết bị là bắt buộc.")
    @Positive(message = "Loại thiết bị không hợp lệ.")
    private Integer categoryId;

    @NotNull(message = "Phòng gốc là bắt buộc.")
    @Positive(message = "Phòng gốc không hợp lệ.")
    private Integer locationId;

    private String status;

    @Size(max = 5000, message = "Thông tin đặc tính kỹ thuật không được vượt quá 5000 ký tự.")
    private String specs;

    @NotNull(message = "Giá mua là bắt buộc.")
    @DecimalMin(value = "0.01", message = "Giá mua phải lớn hơn 0.")
    private BigDecimal purchasePrice;

    @NotNull(message = "Ngày mua là bắt buộc.")
    @PastOrPresent(message = "Ngày mua không được ở tương lai.")
    private LocalDate purchaseDate;

    @NotNull(message = "Hạn bảo hành là bắt buộc.")
    private LocalDate warrantyExpirationDate;

    @NotNull(message = "Nhà cung cấp là bắt buộc.")
    @Positive(message = "Nhà cung cấp không hợp lệ.")
    private Integer supplierId;
}
