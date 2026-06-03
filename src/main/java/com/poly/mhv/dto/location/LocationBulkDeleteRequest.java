package com.poly.mhv.dto.location;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationBulkDeleteRequest {

    @NotEmpty(message = "Can chon it nhat mot phong de xoa.")
    private List<Integer> ids;
}
