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
    private Integer reporterId;
    private Integer assigneeId;
    private String description;
    private String imageUrl;
    private String priority;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime dueDate;
}
