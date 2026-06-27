package com.poly.mhv.dto.statistics;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetStatisticsCountResponse {
    private String label;
    private long count;
    private BigDecimal value;
}
