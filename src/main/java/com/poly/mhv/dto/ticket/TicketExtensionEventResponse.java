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
public class TicketExtensionEventResponse {
    private Integer id;
    private Integer ticketId;
    private String ticketStatus;
    private String priority;
    private String assetName;
    private String assetQaCode;
    private String assigneeName;
    private String requesterName;
    private Integer requestedMinutes;
    private String reason;
    private String status; // PENDING, APPROVED, REJECTED
    private String rejectReason;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime proposedDueDate;
    private Integer proposedMinutes;
}
