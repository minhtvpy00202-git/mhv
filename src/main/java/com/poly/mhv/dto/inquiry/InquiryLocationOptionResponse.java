package com.poly.mhv.dto.inquiry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryLocationOptionResponse {
    private Integer id;
    private String name;
    private String areaTypeKey;
    private String areaTypeLabel;
    private Boolean storageWarehouse;
}
