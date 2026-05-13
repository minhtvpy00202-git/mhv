package com.poly.mhv.dto.techsupporttype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TechSupportTypeCreateRequest {

    @NotBlank(message = "Tên loại kỹ thuật viên là bắt buộc.")
    @Size(max = 100, message = "Tên loại kỹ thuật viên không được vượt quá 100 ký tự.")
    private String name;
}
