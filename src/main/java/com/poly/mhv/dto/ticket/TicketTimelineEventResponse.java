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
public class TicketTimelineEventResponse {
    private Integer id;
    private String eventType;
    private Integer actorId;
    private String actorName;
    private String message;
    private String detail;
    private LocalDateTime occurredAt;
}
