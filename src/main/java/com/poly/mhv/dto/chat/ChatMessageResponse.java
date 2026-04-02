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
public class ChatMessageResponse {
    private Integer id;
    private Integer ticketId;
    private Integer senderId;
    private String content;
    private LocalDateTime createdAt;
}
