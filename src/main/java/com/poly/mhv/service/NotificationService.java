package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationDetailResponse;
import com.poly.mhv.dto.notification.NotificationFeedResponse;
import com.poly.mhv.dto.notification.NotificationItemResponse;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.dto.notification.RealtimeNotificationResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Notification;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AppUserRepository appUserRepository;
    private final AdminAlertSseService adminAlertSseService;
    private final AsyncRealtimePushService asyncRealtimePushService;
    private final CurrentUserProvider currentUserProvider;

    public NotificationService(
            NotificationRepository notificationRepository,
            AppUserRepository appUserRepository,
            AdminAlertSseService adminAlertSseService,
            AsyncRealtimePushService asyncRealtimePushService,
            CurrentUserProvider currentUserProvider
    ) {
        this.notificationRepository = notificationRepository;
        this.appUserRepository = appUserRepository;
        this.adminAlertSseService = adminAlertSseService;
        this.asyncRealtimePushService = asyncRealtimePushService;
        this.currentUserProvider = currentUserProvider;
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
        createNotification(eventType, title, message, actorUsername, assetQaCode, assetName, detail,
                List.of(NotificationTarget.forRole("Admin", "/admin/dashboard")));
    }

    @Transactional
    public void createNotification(
            String eventType,
            String title,
            String message,
            String actorUsername,
            String assetQaCode,
            String assetName,
            Map<String, Object> detail,
            Collection<NotificationTarget> targets
    ) {
        try {
            LocalDateTime occurredAt = LocalDateTime.now();
            String detailJson = formatDetail(detail == null ? Map.of() : detail);
            boolean shouldNotifyAdmin = false;
            for (NotificationTarget target : deduplicateTargets(targets)) {
                Notification notification = Notification.builder()
                        .eventType(eventType)
                        .title(title)
                        .message(message)
                        .linkPath(resolveLinkPath(target))
                        .actorUsername(actorUsername)
                        .assetQaCode(assetQaCode)
                        .assetName(assetName)
                        .receiverUserId(target.receiverUserId())
                        .receiverRole(target.receiverRole())
                        .detailJson(detailJson)
                        .occurredAt(occurredAt)
                        .isRead(false)
                        .build();
                Notification saved = notificationRepository.save(notification);
                pushRealtime(saved);
                if ("Admin".equals(target.receiverRole())) {
                    shouldNotifyAdmin = true;
                }
            }
            if (shouldNotifyAdmin) {
                adminAlertSseService.notifyNotificationAlert(eventType, title, message);
            }
        } catch (Exception ex) {
            throw new CustomException("Không thể tạo thông báo hệ thống.");
        }
    }

    @Transactional(readOnly = true)
    public NotificationFeedResponse getFeed() {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        List<NotificationItemResponse> items = notificationRepository.findTop50FeedItemsForViewer(
                currentUser.getId(),
                currentUser.getRole(),
                PageRequest.of(0, 50)
        );
        NotificationFeedResponse response = NotificationFeedResponse.builder()
                .unreadCount(notificationRepository.countUnreadForViewer(currentUser.getId(), currentUser.getRole()))
                .items(items)
                .build();
        return response;
    }

    @Transactional
    public NotificationDetailResponse getDetailAndMarkAsRead(Integer id) {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        Notification notification = notificationRepository.findAccessibleById(id, currentUser.getId(), currentUser.getRole())
                .orElseThrow(() -> new CustomException("Không tìm thấy thông báo."));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
        }
        return mapToDetail(notification);
    }

    @Transactional
    public void markAsRead(Integer id) {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        Notification notification = notificationRepository.findAccessibleById(id, currentUser.getId(), currentUser.getRole())
                .orElseThrow(() -> new CustomException("Không tìm thấy thông báo."));
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
        }
    }

    @Transactional
    public void markAllAsRead() {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        notificationRepository.markAllAsReadForViewer(currentUser.getId(), currentUser.getRole());
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

    private List<NotificationTarget> deduplicateTargets(Collection<NotificationTarget> targets) {
        if (targets == null || targets.isEmpty()) {
            return List.of(NotificationTarget.forRole("Admin", "/admin/dashboard"));
        }
        Map<String, NotificationTarget> deduplicated = new LinkedHashMap<>();
        for (NotificationTarget target : targets) {
            if (target == null) {
                continue;
            }
            Integer receiverUserId = target.receiverUserId();
            String receiverRole = StringUtils.hasText(target.receiverRole()) ? target.receiverRole().trim() : null;
            String linkPath = resolveLinkPath(target);
            if (receiverUserId == null && !StringUtils.hasText(receiverRole)) {
                continue;
            }
            String dedupeKey = (receiverUserId != null ? "U:" + receiverUserId : "R:" + receiverRole) + "|" + linkPath;
            deduplicated.putIfAbsent(dedupeKey, new NotificationTarget(receiverUserId, receiverRole, linkPath));
        }
        return new LinkedHashSet<>(deduplicated.values()).stream().toList();
    }

    private String resolveLinkPath(NotificationTarget target) {
        if (target != null && StringUtils.hasText(target.linkPath())) {
            return target.linkPath().trim();
        }
        if (target != null && StringUtils.hasText(target.receiverRole())) {
            return switch (target.receiverRole().trim()) {
                case "ConsumableManager" -> "/supply/consumables";
                case "TechSupport" -> "/tech/tickets";
                case "NhanVien" -> "/mobile/home";
                default -> "/admin/dashboard";
            };
        }
        return "/mobile/home";
    }

    private void pushRealtime(Notification notification) {
        RealtimeNotificationResponse payload = RealtimeNotificationResponse.builder()
                .notificationId(notification.getId())
                .type(notification.getEventType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .linkPath(notification.getLinkPath())
                .assetQaCode(notification.getAssetQaCode())
                .timestamp(notification.getOccurredAt())
                .build();

        if (notification.getReceiverUserId() != null) {
            asyncRealtimePushService.pushToDestination("/topic/users/" + notification.getReceiverUserId() + "/notifications", payload);
            return;
        }
        if (!StringUtils.hasText(notification.getReceiverRole())) {
            return;
        }
        for (AppUser receiver : appUserRepository.findByRole(notification.getReceiverRole())) {
            asyncRealtimePushService.pushToDestination("/topic/users/" + receiver.getId() + "/notifications", payload);
        }
    }
}
