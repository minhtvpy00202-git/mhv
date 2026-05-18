package com.poly.mhv.dto.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoryUpdateRequest {

    @NotBlank(message = "Tên loại thiết bị là bắt buộc.")
    @Size(min = 2, max = 50, message = "Tên loại thiết bị phải từ 2 đến 50 ký tự.")
    private String name;

    @NotNull(message = "Nhóm kỹ thuật phụ trách là bắt buộc.")
    @Positive(message = "Nhóm kỹ thuật phụ trách không hợp lệ.")
    private Integer techTypeId;

    @Size(max = 30, message = "Không được khai báo quá 30 template đặc tính kỹ thuật.")
    private List<@Size(max = 100, message = "Mỗi template đặc tính kỹ thuật không được vượt quá 100 ký tự.") String> specTemplates;
}
