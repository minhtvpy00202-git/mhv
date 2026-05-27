package com.poly.mhv.dto.category;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategorySummaryRow {
    private Integer id;
    private String name;
    private String categoryKind;
    private Integer techTypeId;
    private String techTypeName;
    private String specTemplatesJson;
}
