package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.util.UtcDateTimes;
import com.poly.mhv.util.TicketStatusSupport;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class TicketSlaWarningScheduler {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final TicketRepository ticketRepository;
    private final TicketEventRepository ticketEventRepository;
    private final NotificationService notificationService;
    private final TicketEventService ticketEventService;
    private final TicketService ticketService;

    @Scheduled(cron = "30 */5 * * * *", zone = "Asia/Ho_Chi_Minh")
    public void closeExpiredConfirmations() {
        ticketService.autoCloseExpiredConfirmations();
    }

    @Scheduled(cron = "0 */5 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void checkSlaBreaches() {
        List<Ticket> activeTickets = new ArrayList<>();
        activeTickets.addAll(ticketRepository.findByStatus(TicketStatusSupport.PENDING));
        activeTickets.addAll(ticketRepository.findByStatus(TicketStatusSupport.IN_PROGRESS));
        activeTickets.addAll(ticketRepository.findByStatus(TicketStatusSupport.WAITING_REPLACEMENT));

        LocalDateTime now = UtcDateTimes.now();

        for (Ticket ticket : activeTickets) {
            if (ticket.getDueDate() == null || ticket.getCreatedAt() == null) {
                continue;
            }

            long totalSlaMinutes = Duration.between(ticket.getCreatedAt(), ticket.getDueDate()).toMinutes();
            if (totalSlaMinutes <= 0) {
                continue;
            }

            long elapsedMinutes = Duration.between(ticket.getCreatedAt(), now).toMinutes();
            double ratio = (double) elapsedMinutes / totalSlaMinutes;

            if (ratio >= 1.0) {
                boolean breachSent = ticketEventRepository.existsByTicketIdAndEventType(ticket.getId(), "SLA_BREACHED");
                if (!breachSent) {
                    sendSlaBreach(ticket, totalSlaMinutes, elapsedMinutes);
                }
            } else if (ratio >= 0.90) {
                boolean warning90Sent = ticketEventRepository.existsByTicketIdAndEventType(ticket.getId(), "SLA_WARNING_90");
                if (!warning90Sent) {
                    sendSlaWarning(ticket, 90, totalSlaMinutes, elapsedMinutes);
                }
            } else if (ratio >= 0.75 && ratio < 0.90) {
                boolean warning75Sent = ticketEventRepository.existsByTicketIdAndEventType(ticket.getId(), "SLA_WARNING_75");
                if (!warning75Sent) {
                    sendSlaWarning(ticket, 75, totalSlaMinutes, elapsedMinutes);
                }
            }
        }
    }

    private void sendSlaWarning(Ticket ticket, int level, long totalSla, long elapsed) {
        String assigneeName = "Chưa phân công";
        if (ticket.getAssignee() != null) {
            assigneeName = StringUtils.hasText(ticket.getAssignee().getFullName())
                    ? ticket.getAssignee().getFullName().trim()
                    : ticket.getAssignee().getUsername();
        }

        String eventType = "SLA_WARNING_" + level;
        String title = "Cảnh báo " + level + "% SLA cho ticket #" + ticket.getId();
        long remaining = Math.max(0, totalSla - elapsed);
        String message = "Ticket #" + ticket.getId() + " (" + ticket.getAsset().getName() + ") đã trôi qua " + level + "% thời gian SLA xử lý (còn lại khoảng " + remaining + " phút). Hạn hoàn thành: "
                + ticket.getDueDate().format(DATE_FORMATTER) + ".";

        List<NotificationTarget> targets = new ArrayList<>();
        // Send to Admin role
        targets.add(NotificationTarget.forRole("Admin", "/admin/tickets"));
        // Send to TechSupport assignee
        if (ticket.getAssignee() != null && ticket.getAssignee().getId() != null) {
            targets.add(NotificationTarget.forUser(ticket.getAssignee().getId(), "/tech/tickets/" + ticket.getId()));
        }

        notificationService.createNotification(
                eventType,
                title,
                message,
                "system",
                ticket.getAsset().getQaCode(),
                ticket.getAsset().getName(),
                Map.of(
                        "Ticket ID", "#" + ticket.getId(),
                        "Mức độ cảnh báo", level + "%",
                        "Thời gian còn lại", remaining + " phút",
                        "Kỹ thuật viên phụ trách", assigneeName
                ),
                targets
        );

        // Record warning event to avoid duplicate alarms
        ticketEventService.recordEvent(
                ticket,
                eventType,
                null,
                "[Hệ thống cảnh báo] Đã trôi qua " + level + "% SLA xử lý. Thời gian còn lại: " + remaining + " phút.",
                Map.of("level", level, "remainingMinutes", remaining)
        );
    }

    private void sendSlaBreach(Ticket ticket, long totalSla, long elapsed) {
        long overdueMinutes = Math.max(0, elapsed - totalSla);
        String assigneeName = ticket.getAssignee() == null
                ? "Chưa phân công"
                : (StringUtils.hasText(ticket.getAssignee().getFullName())
                        ? ticket.getAssignee().getFullName().trim()
                        : ticket.getAssignee().getUsername());
        List<NotificationTarget> targets = new ArrayList<>();
        targets.add(NotificationTarget.forRole("Admin", "/admin/tickets"));
        if (ticket.getAssignee() != null && ticket.getAssignee().getId() != null) {
            targets.add(NotificationTarget.forUser(
                    ticket.getAssignee().getId(), "/tech/tickets/" + ticket.getId()));
        }
        notificationService.createNotification(
                "SLA_BREACHED",
                "Ticket #" + ticket.getId() + " đã quá hạn SLA",
                "Ticket #" + ticket.getId() + " (" + ticket.getAsset().getName()
                        + ") đã quá hạn khoảng " + overdueMinutes + " phút.",
                "system",
                ticket.getAsset().getQaCode(),
                ticket.getAsset().getName(),
                Map.of(
                        "Ticket ID", "#" + ticket.getId(),
                        "Quá hạn", overdueMinutes + " phút",
                        "Kỹ thuật viên phụ trách", assigneeName),
                targets);
        ticketEventService.recordEvent(
                ticket,
                "SLA_BREACHED",
                null,
                "[Hệ thống cảnh báo] Ticket đã quá hạn SLA " + overdueMinutes + " phút.",
                Map.of("overdueMinutes", overdueMinutes));
    }
}
