package com.poly.mhv.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationUpdateRequest {

    @NotBlank(message = "Tên phòng là bắt buộc.")
    @Size(max = 100, message = "Tên phòng không được vượt quá 100 ký tự.")
    private String roomName;

    private Integer floorId;

    private String areaTypeKey;

    @Size(max = 150, message = "Tên loại khu vực không được vượt quá 150 ký tự.")
    private String areaTypeLabel;
}
