package com.poly.mhv.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {
    @NotBlank(message = "Username là bắt buộc.")
    @Size(min = 4, max = 50, message = "Username phải từ 4 đến 50 ký tự.")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username chỉ được chứa chữ cái, số và dấu gạch dưới.")
    private String username;

    @NotBlank(message = "Password là bắt buộc.")
    @Size(min = 6, max = 100, message = "Password phải từ 6 đến 100 ký tự.")
    private String password;
}
