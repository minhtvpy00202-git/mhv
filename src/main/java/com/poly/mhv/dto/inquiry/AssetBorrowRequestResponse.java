package com.poly.mhv.dto.inquiry;

import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetBorrowRequestResponse {
    private Long id;
    private Long inquiryId;
    private String assetQaCode;
    private String assetName;
    private Integer requesterId;
    private String requesterName;
    private Integer approvedByUserId;
    private String approvedByName;
    private Integer destinationLocationId;
    private String destinationLocationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private OffsetDateTime startAt;
    private OffsetDateTime endAt;
    private String purpose;
    private String status;
    private String decisionNote;
    private OffsetDateTime createdAt;
    private OffsetDateTime approvedAt;
    private OffsetDateTime reservedAt;
    private OffsetDateTime reservationExpiresAt;
    private OffsetDateTime checkedOutAt;
    private OffsetDateTime returnedAt;
}
