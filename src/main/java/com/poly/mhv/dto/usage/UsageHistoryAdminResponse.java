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
public class UsageHistoryAdminResponse {
    private Integer id;
    private String assetQaCode;
    private String assetName;
    private String homeLocationName;
    private LocalDateTime startTime;
    private String borrowedLocationName;
    private LocalDateTime endTime;
    private String username;
}
