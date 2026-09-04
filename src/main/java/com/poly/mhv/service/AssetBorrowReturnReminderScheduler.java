package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Slf4j
@RequiredArgsConstructor
public class AssetBorrowReturnReminderScheduler {

    private final AssetBorrowRequestRepository assetBorrowRequestRepository;
    private final AssetBorrowRequestService assetBorrowRequestService;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;

    @Scheduled(cron = "15 * * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void checkoutReservedRequests() {
        assetBorrowRequestService.expirePendingRequestsPastEndTime();
        LocalDateTime now = UtcDateTimes.now();
        List<AssetBorrowRequest> readyRequests = assetBorrowRequestRepository.findReservedReadyToCheckout(now);
        for (AssetBorrowRequest request : readyRequests) {
            try {
                assetBorrowRequestService.checkoutReserved(request.getId());
            } catch (RuntimeException exception) {
                log.warn("Cannot auto-checkout borrow request #{} for asset {}: {}",
                        request.getId(),
                        request.getAsset() != null ? request.getAsset().getQaCode() : "unknown",
                        exception.getMessage());
            }
        }
    }

    @Scheduled(cron = "45 */10 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void remindOverdueReturns() {
        LocalDateTime now = UtcDateTimes.now();
        List<AssetBorrowRequest> overdueRequests = assetBorrowRequestRepository.findCheckedOutOverdueForReminder(
                now,
                now.minusHours(12)
        );
        for (AssetBorrowRequest request : overdueRequests) {
            sendReminder(request, now);
        }
    }

    private void sendReminder(AssetBorrowRequest request, LocalDateTime now) {
        String message = "Thiết bị " + request.getAsset().getQaCode()
                + " đã quá hạn trả từ " + request.getEndAt() + ".";
        notificationService.createNotification(
                "BORROW_RETURN_OVERDUE",
                "Có tài sản cần trả",
                message,
                "system",
                request.getAsset().getQaCode(),
                request.getAsset().getName(),
                Map.of(
                        "Phiếu mượn", "#" + request.getId(),
                        "Thiết bị", request.getAsset().getQaCode() + " - " + request.getAsset().getName(),
                        "Người mượn", request.getRequester().getFullName() != null
                                ? request.getRequester().getFullName()
                                : request.getRequester().getUsername(),
                        "Hẹn trả", request.getEndAt(),
                        "Phòng sử dụng", request.getDestinationLocation().getRoomName()
                ),
                List.of(
                        NotificationTarget.forRole("Admin", "/admin/borrow-requests/" + request.getId()),
                        NotificationTarget.forUser(request.getRequester().getId(), "/mobile/home")
                )
        );
        request.setLastOverdueReminderAt(now);
        assetBorrowRequestRepository.save(request);
        realtimePushService.pushToDestination(
                "/topic/users/" + request.getRequester().getId() + "/borrow-requests",
                Map.of(
                        "borrowRequestId", request.getId(),
                        "status", request.getStatus(),
                        "overdueReturn", true,
                        "updatedAt", now
                )
        );
    }
}
