package com.poly.mhv.dto.supplier;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupplierResponse {
    private Integer id;
    private String name;
    private String address;
    private String phoneNumber;
    private long assetCount;
}
