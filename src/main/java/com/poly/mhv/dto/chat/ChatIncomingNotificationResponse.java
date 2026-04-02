package com.poly.mhv.dto.chat;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatIncomingNotificationResponse {
    private Integer ticketId;
    private Integer senderId;
    private String senderName;
    private String messagePreview;
    private LocalDateTime createdAt;
}
