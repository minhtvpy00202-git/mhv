package com.poly.mhv.dto.user;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAdminRequest {
    private String username;
    private String password;
    private String role;
    private String fullName;
    private LocalDate birthday;
    private String phone;
    private String status;
}
