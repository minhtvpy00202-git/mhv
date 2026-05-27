package com.poly.mhv.dto.category;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryResponse {
    private Integer id;
    private String name;
    private String codePrefix;
    private String categoryKind;
    private Integer techTypeId;
    private String techTypeName;
    private List<String> specTemplates;
}
