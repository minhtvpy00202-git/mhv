package com.poly.mhv.dto.ticket;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketCreateRequest {
    @JsonAlias({"assetQaCode", "asset_qa_code"})
    private String assetQaCode;
    private String description;
    private String priority;
    @JsonAlias({"imageUrl", "image_url"})
    private String imageUrl;
}
