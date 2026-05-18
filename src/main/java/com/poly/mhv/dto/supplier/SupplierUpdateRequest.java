package com.poly.mhv.dto.supplier;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SupplierUpdateRequest {

    @NotBlank(message = "Tên nhà cung cấp là bắt buộc.")
    @Size(min = 2, max = 150, message = "Tên nhà cung cấp phải từ 2 đến 150 ký tự.")
    private String name;

    @NotBlank(message = "Địa chỉ nhà cung cấp là bắt buộc.")
    @Size(min = 5, max = 255, message = "Địa chỉ nhà cung cấp phải từ 5 đến 255 ký tự.")
    private String address;

    @NotBlank(message = "Số điện thoại nhà cung cấp là bắt buộc.")
    @Size(max = 20, message = "Số điện thoại nhà cung cấp không được vượt quá 20 ký tự.")
    @Pattern(regexp = "^0\\d{9}$", message = "Số điện thoại nhà cung cấp phải gồm 10 chữ số và bắt đầu bằng số 0.")
    private String phoneNumber;
}
