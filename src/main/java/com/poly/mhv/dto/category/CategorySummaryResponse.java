package com.poly.mhv.dto.category;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategorySummaryResponse {
    private Integer id;
    private String name;
    private String codePrefix;
    private Integer techTypeId;
    private String techTypeName;
    private boolean specTemplatesConfigured;
}
