package com.poly.mhv.service;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.time.Duration;
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

    @Scheduled(cron = "0 */5 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void checkSlaBreaches() {
        List<Ticket> activeTickets = new ArrayList<>();
        activeTickets.addAll(ticketRepository.findByStatus("PENDING"));
        activeTickets.addAll(ticketRepository.findByStatus("IN_PROGRESS"));

        LocalDateTime now = LocalDateTime.now();

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

            if (ratio >= 0.90 && ratio < 1.0) {
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
}
