package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
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
    @Size(max = 20, message = "Kiểu theo dõi không hợp lệ.")
    private String trackingMode;

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

    @DecimalMin(value = "0.01", message = "Giá mua phải lớn hơn 0.")
    private BigDecimal purchasePrice;

    @PastOrPresent(message = "Ngày mua không được ở tương lai.")
    private LocalDate purchaseDate;

    private Boolean expiryTrackingEnabled;

    private LocalDate expirationDate;

    private LocalDate warrantyExpirationDate;

    @Positive(message = "Nhà cung cấp không hợp lệ.")
    private Integer supplierId;

    @PositiveOrZero(message = "Số lượng tồn không được âm.")
    private Integer quantityOnHand;

    @PositiveOrZero(message = "Ngưỡng cảnh báo tồn không được âm.")
    private Integer minimumStock;

    @Size(max = 50, message = "Đơn vị tính không được vượt quá 50 ký tự.")
    private String unit;
}
