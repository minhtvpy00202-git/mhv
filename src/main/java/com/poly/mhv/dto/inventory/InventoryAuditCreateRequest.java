package com.poly.mhv.dto.inventory;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryAuditCreateRequest {
    @NotNull(message = "locationId là bắt buộc.")
    private Integer locationId;

    @NotNull(message = "dueDate là bắt buộc.")
    private LocalDateTime dueDate;

    private String notes;
}
