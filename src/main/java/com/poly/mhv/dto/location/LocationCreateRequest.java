package com.poly.mhv.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationCreateRequest {

    @NotBlank(message = "Tên phòng là bắt buộc.")
    @Size(max = 100, message = "Tên phòng không được vượt quá 100 ký tự.")
    private String roomName;
}
