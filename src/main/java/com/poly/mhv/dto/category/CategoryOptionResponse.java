package com.poly.mhv.dto.category;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryOptionResponse {
    private Integer id;
    private String name;
    private String codePrefix;
    private String categoryKind;
}
