package com.poly.mhv.dto.notification;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationFeedResponse {
    private long unreadCount;
    private List<NotificationItemResponse> items;
}
