package com.poly.mhv.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JwtResponse {
    private String token;
    private Integer id;
    private String username;
    private String role;
    private Integer techTypeId;
    private String techTypeName;
}
