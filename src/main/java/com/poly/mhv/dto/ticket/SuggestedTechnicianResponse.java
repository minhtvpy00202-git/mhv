package com.poly.mhv.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuggestedTechnicianResponse {
    private Integer id;
    private String username;
    private String fullName;
    private long activeCount;
    private long resolvedCount;
    private String recommendationReason;
}
