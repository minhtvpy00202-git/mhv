package com.poly.mhv.dto.inquiry;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryOptionsResponse {
    private List<InquiryLocationOptionResponse> locations;
    private List<InquiryUserOptionResponse> handlers;
}
