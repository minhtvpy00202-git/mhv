package com.poly.mhv.dto.asset;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
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
public class AssetUpdateRequest {
    @Size(min = 2, max = 150, message = "Tên thiết bị phải từ 2 đến 150 ký tự.")
    private String name;

    @Positive(message = "Loại thiết bị không hợp lệ.")
    private Integer categoryId;

    @Positive(message = "Phòng gốc không hợp lệ.")
    private Integer locationId;

    @Pattern(
            regexp = "^(Sẵn sàng|Đang sử dụng|Hỏng|Bảo trì|Thất lạc)$",
            message = "Trạng thái thiết bị không hợp lệ."
    )
    private String status;

    @Size(max = 5000, message = "Thông tin đặc tính kỹ thuật không được vượt quá 5000 ký tự.")
    private String specs;

    @DecimalMin(value = "0.01", message = "Giá mua phải lớn hơn 0.")
    private BigDecimal purchasePrice;

    @PastOrPresent(message = "Ngày mua không được ở tương lai.")
    private LocalDate purchaseDate;

    private LocalDate warrantyExpirationDate;

    @Positive(message = "Nhà cung cấp không hợp lệ.")
    private Integer supplierId;
}
