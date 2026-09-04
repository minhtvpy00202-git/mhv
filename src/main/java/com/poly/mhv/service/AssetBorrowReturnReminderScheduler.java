package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class AssetBorrowReturnReminderScheduler {

    private final AssetBorrowRequestRepository assetBorrowRequestRepository;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;

    @Scheduled(cron = "45 */10 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void remindOverdueReturns() {
        LocalDateTime now = UtcDateTimes.now();
        List<AssetBorrowRequest> overdueRequests = assetBorrowRequestRepository.findCheckedOutOverdueForReminder(
                LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")),
                now.minusHours(12)
        );
        for (AssetBorrowRequest request : overdueRequests) {
            sendReminder(request, now);
        }
    }

    private void sendReminder(AssetBorrowRequest request, LocalDateTime now) {
        String message = "Thiết bị " + request.getAsset().getQaCode()
                + " đã quá hạn trả từ ngày " + request.getExpectedReturnDate() + ".";
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
                        "Ngày hẹn trả", request.getExpectedReturnDate(),
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
