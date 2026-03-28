package com.poly.mhv.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {
    @NotBlank(message = "Tên đăng nhập là bắt buộc.")
    @Size(min = 4, max = 50, message = "Tên đăng nhập phải từ 4 đến 50 ký tự.")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Tên đăng nhập chỉ gồm chữ, số và dấu gạch dưới.")
    private String username;

    @NotBlank(message = "Mật khẩu là bắt buộc.")
    @Size(min = 6, max = 100, message = "Mật khẩu phải từ 6 đến 100 ký tự.")
    private String password;

    @NotBlank(message = "Họ và tên là bắt buộc.")
    @Size(min = 2, max = 100, message = "Họ và tên phải từ 2 đến 100 ký tự.")
    private String fullName;

    @NotNull(message = "Ngày sinh là bắt buộc.")
    @Past(message = "Ngày sinh phải là ngày trong quá khứ.")
    private LocalDate birthday;

    @NotBlank(message = "Số điện thoại là bắt buộc.")
    @Pattern(regexp = "^0\\d{9}$", message = "Số điện thoại phải gồm đúng 10 số và bắt đầu bằng 0.")
    private String phone;
}
