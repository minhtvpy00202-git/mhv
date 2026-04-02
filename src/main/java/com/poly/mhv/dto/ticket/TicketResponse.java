package com.poly.mhv.dto.ticket;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponse {
    private Integer id;
    private String assetQaCode;
    private String assetName;
    private String assetLocationName;
    private String assetCategoryName;
    private Integer assetCategoryTechTypeId;
    private Integer reporterId;
    private String reporterName;
    private String reporterRole;
    private Integer assigneeId;
    private String assigneeName;
    private String description;
    private String imageUrl;
    private String priority;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime dueDate;
    private LocalDateTime resolvedAt;
}
