package com.poly.mhv.dto.techsupporttype;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TechSupportTypeResponse {
    private Integer id;
    private String name;
    private long categoryCount;
    private long techSupportUserCount;
}
