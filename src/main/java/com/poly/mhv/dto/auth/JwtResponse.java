package com.poly.mhv.dto.auth;

import java.util.List;
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
    private String fullName;
    private String role;
    private List<Integer> techTypeIds;
    private List<String> techTypeNames;
}
