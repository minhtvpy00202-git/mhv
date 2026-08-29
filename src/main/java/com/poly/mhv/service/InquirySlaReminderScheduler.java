package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class InquirySlaReminderScheduler {

    private final ServiceInquiryRepository inquiryRepository;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;
    private final InquiryWorkflowSettingService workflowSettingService;

    @Scheduled(cron = "15 */5 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void remindOverdueResponses() {
        LocalDateTime now = UtcDateTimes.now();
        int reminderIntervalHours = workflowSettingService.getEffectiveSettings().overdueReminderIntervalHours();
        List<ServiceInquiry> overdue = inquiryRepository.findResponseSlaOverdue(
                now,
                InquiryStatusSupport.TERMINAL_STATUSES);
        for (ServiceInquiry inquiry : overdue) {
            if (inquiry.getLastOverdueReminderAt() != null
                    && inquiry.getLastOverdueReminderAt().isAfter(now.minusHours(reminderIntervalHours))) {
                continue;
            }
            sendReminder(inquiry, now);
        }
    }

    private void sendReminder(ServiceInquiry inquiry, LocalDateTime now) {
        long overdueMinutes = Math.max(1, Duration.between(inquiry.getSlaResponseDueAt(), now).toMinutes());
        boolean firstReminder = inquiry.getSlaBreachedAt() == null;
        List<NotificationTarget> targets = new ArrayList<>();
        String handlerPath = "ConsumableManager".equals(inquiry.getTargetRole())
                ? "/supply/inquiries/" + inquiry.getId()
                : "/admin/inquiries/" + inquiry.getId();
        if (inquiry.getAssignee() != null) {
            targets.add(NotificationTarget.forUser(inquiry.getAssignee().getId(), handlerPath));
        } else {
            targets.add(NotificationTarget.forRole(inquiry.getTargetRole(), handlerPath));
        }
        if (firstReminder) {
            targets.add(NotificationTarget.forUser(
                    inquiry.getRequester().getId(),
                    "/mobile/inquiries/" + inquiry.getId()));
        }
        notificationService.createNotification(
                "INQUIRY_RESPONSE_SLA_BREACHED",
                "Yêu cầu #" + inquiry.getId() + " chưa được phản hồi đúng hạn",
                "Yêu cầu về " + inquiry.getAsset().getName() + " đã quá hạn phản hồi khoảng "
                        + overdueMinutes + " phút.",
                "system",
                inquiry.getAsset().getQaCode(),
                inquiry.getAsset().getName(),
                Map.of(
                        "Yêu cầu", "#" + inquiry.getId(),
                        "Quá hạn phản hồi", overdueMinutes + " phút",
                        "Bộ phận phụ trách", inquiry.getTargetRole()),
                targets);
        if (firstReminder) {
            inquiry.setSlaBreachedAt(inquiry.getSlaResponseDueAt());
        }
        inquiry.setLastOverdueReminderAt(now);
        inquiry.setOverdueReminderCount((inquiry.getOverdueReminderCount() == null ? 0 : inquiry.getOverdueReminderCount()) + 1);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        Map<String, Object> payload = Map.of(
                "inquiryId", inquiry.getId(),
                "status", inquiry.getStatus(),
                "slaBreached", true,
                "updatedAt", now);
        realtimePushService.pushToDestination(
                "/topic/users/" + inquiry.getRequester().getId() + "/inquiry-updates",
                payload);
        if (inquiry.getAssignee() != null) {
            realtimePushService.pushToDestination(
                    "/topic/users/" + inquiry.getAssignee().getId() + "/inquiry-updates",
                    payload);
        }
    }
}
