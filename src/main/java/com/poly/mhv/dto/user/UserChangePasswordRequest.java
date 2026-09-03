package com.poly.mhv.dto.user;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserChangePasswordRequest {

    @NotBlank(message = "Mật khẩu hiện tại là bắt buộc.")
    private String currentPassword;

    @NotBlank(message = "Mật khẩu mới là bắt buộc.")
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu mới là bắt buộc.")
    private String confirmNewPassword;
}
