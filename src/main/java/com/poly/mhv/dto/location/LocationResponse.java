package com.poly.mhv.dto.location;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationResponse {
    private Integer id;
    private String roomName;
    private Integer floorId;
    private String floorName;
    private String areaTypeKey;
    private String areaTypeLabel;
    private Boolean isStorageWarehouse;
}
