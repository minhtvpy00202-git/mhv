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
public class RealtimeNotificationResponse {
    private Integer notificationId;
    private String type;
    private String title;
    private String message;
    private String linkPath;
    private Integer ticketId;
    private String assetQaCode;
    private String status;
    private LocalDateTime timestamp;
}
