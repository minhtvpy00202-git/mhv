package com.poly.mhv.dto.usage;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UsageHistoryResponse {
    private Integer id;
    private String assetQaCode;
    private Integer userId;
    private Integer fromLocationId;
    private Integer toLocationId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}
