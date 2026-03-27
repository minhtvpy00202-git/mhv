package com.poly.mhv.dto.notification;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDetailResponse {
    private Integer id;
    private String eventType;
    private String title;
    private String message;
    private String linkPath;
    private String actorUsername;
    private String assetQaCode;
    private LocalDateTime occurredAt;
    private Boolean isRead;
    private String detail;
}
