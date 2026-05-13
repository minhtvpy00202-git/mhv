package com.poly.mhv.dto.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoryCreateRequest {

    @NotBlank(message = "Tên loại thiết bị là bắt buộc.")
    @Size(max = 50, message = "Tên loại thiết bị không được vượt quá 50 ký tự.")
    private String name;

    @NotNull(message = "Nhóm kỹ thuật phụ trách là bắt buộc.")
    private Integer techTypeId;
}
