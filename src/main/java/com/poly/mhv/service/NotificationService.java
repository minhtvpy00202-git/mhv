package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationDetailResponse;
import com.poly.mhv.dto.notification.NotificationFeedResponse;
import com.poly.mhv.dto.notification.NotificationItemResponse;
import com.poly.mhv.entity.Notification;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AdminAlertSseService adminAlertSseService;

    public NotificationService(NotificationRepository notificationRepository, AdminAlertSseService adminAlertSseService) {
        this.notificationRepository = notificationRepository;
        this.adminAlertSseService = adminAlertSseService;
    }

    @Transactional
    public void createNotification(
            String eventType,
            String title,
            String message,
            String actorUsername,
            String assetQaCode,
            String assetName,
            Map<String, Object> detail
    ) {
        try {
            String detailJson = formatDetail(detail == null ? Map.of() : detail);
            Notification notification = Notification.builder()
                    .eventType(eventType)
                    .title(title)
                    .message(message)
                    .linkPath("/admin/notifications/0")
                    .actorUsername(actorUsername)
                    .assetQaCode(assetQaCode)
                    .assetName(assetName)
                    .detailJson(detailJson)
                    .occurredAt(LocalDateTime.now())
                    .isRead(false)
                    .build();
            Notification saved = notificationRepository.save(notification);
            saved.setLinkPath("/admin/notifications/" + saved.getId());
            notificationRepository.save(saved);
            adminAlertSseService.notifyNotificationAlert(saved.getEventType(), saved.getTitle(), saved.getMessage());
        } catch (Exception ex) {
            throw new CustomException("Không thể tạo thông báo hệ thống.");
        }
    }

    @Transactional(readOnly = true)
    public NotificationFeedResponse getFeed() {
        List<NotificationItemResponse> items = notificationRepository.findTop50ByOrderByOccurredAtDescIdDesc().stream()
                .map(this::mapToItem)
                .toList();
        return NotificationFeedResponse.builder()
                .unreadCount(notificationRepository.countByIsReadFalse())
                .items(items)
                .build();
    }

    @Transactional
    public NotificationDetailResponse getDetailAndMarkAsRead(Integer id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy thông báo."));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notificationRepository.save(notification);
        }
        return mapToDetail(notification);
    }

    @Transactional
    public void markAsRead(Integer id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy thông báo."));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notificationRepository.save(notification);
        }
    }

    @Transactional
    public void markAllAsRead() {
        notificationRepository.markAllAsRead();
    }

    private NotificationItemResponse mapToItem(Notification notification) {
        return NotificationItemResponse.builder()
                .id(notification.getId())
                .eventType(notification.getEventType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .assetName(notification.getAssetName())
                .linkPath(notification.getLinkPath())
                .occurredAt(notification.getOccurredAt())
                .isRead(notification.getIsRead())
                .build();
    }

    private NotificationDetailResponse mapToDetail(Notification notification) {
        return NotificationDetailResponse.builder()
                .id(notification.getId())
                .eventType(notification.getEventType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .linkPath(notification.getLinkPath())
                .actorUsername(notification.getActorUsername())
                .assetQaCode(notification.getAssetQaCode())
                .occurredAt(notification.getOccurredAt())
                .isRead(notification.getIsRead())
                .detail(notification.getDetailJson())
                .build();
    }

    private String formatDetail(Map<String, Object> detail) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, Object> entry : detail.entrySet()) {
            String value = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
            if (!value.isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(entry.getKey()).append(": ").append(value);
            }
        }
        return builder.toString();
    }
}
