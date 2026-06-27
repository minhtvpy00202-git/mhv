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
public class AssetStatisticsRankResponse {
    private String qaCode;
    private String name;
    private String categoryName;
    private String locationName;
    private long count;
    private Integer quantityOnHand;
    private Integer minimumStock;
    private String unit;
    private BigDecimal unitValue;
}
