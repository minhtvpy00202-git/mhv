package com.poly.mhv.service;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.notification.RealtimeNotificationResponse;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public TicketResponse createTicket(TicketCreateRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu ticket không được để trống.");
        }
        if (!StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("asset_qa_code là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getDescription())) {
            throw new CustomException("description là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getPriority())) {
            throw new CustomException("priority là bắt buộc.");
        }

        String priority = request.getPriority().trim().toUpperCase();
        if (!List.of("LOW", "MEDIUM", "HIGH").contains(priority)) {
            throw new CustomException("priority không hợp lệ.");
        }

        Asset asset = assetRepository.findById(request.getAssetQaCode().trim())
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với asset_qa_code đã cung cấp."));
        AppUser reporter = currentUserProvider.getCurrentUser();
        LocalDateTime createdAt = LocalDateTime.now();

        String imageUrl = null;
        if (StringUtils.hasText(request.getImageUrl())) {
            imageUrl = request.getImageUrl().trim();
        }

        Ticket ticket = Ticket.builder()
                .asset(asset)
                .reporter(reporter)
                .description(request.getDescription().trim())
                .imageUrl(imageUrl)
                .priority(priority)
                .status("PENDING")
                .createdAt(createdAt)
                .dueDate(calculateDueDate(priority, createdAt))
                .build();

        asset.setStatus("Hỏng");
        assetRepository.save(asset);
        Ticket saved = ticketRepository.save(ticket);
        notificationService.createNotification(
                "TICKET_CREATED",
                "Ticket mới cần tiếp nhận",
                reporter.getUsername() + " đã tạo ticket #" + saved.getId() + " cho thiết bị " + asset.getQaCode() + ".",
                reporter.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Mức ưu tiên", saved.getPriority(),
                        "Trạng thái", saved.getStatus()
                )
        );
        pushNotification(
                "TICKET_CREATED",
                "Ticket #" + saved.getId() + " đã được tạo.",
                saved
        );
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse assignTicket(Integer ticketId, TicketAssignRequest request) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }
        if (request == null || request.getAssigneeId() == null) {
            throw new CustomException("assignee_id là bắt buộc.");
        }

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if (!"PENDING".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket ở trạng thái PENDING mới được gán kỹ thuật viên.");
        }

        AppUser assignee = appUserRepository.findById(request.getAssigneeId())
                .orElseThrow(() -> new CustomException("Không tìm thấy kỹ thuật viên được gán."));
        if (!"TechSupport".equals(assignee.getRole())) {
            throw new CustomException("Người được gán phải có vai trò TechSupport.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("TechSupport".equals(actor.getRole()) && !actor.getId().equals(assignee.getId())) {
            throw new CustomException("Kỹ thuật viên chỉ được nhận ticket cho chính mình.");
        }

        ticket.setAssignee(assignee);
        ticket.setStatus("IN_PROGRESS");
        ticket.getAsset().setStatus("Bảo trì");
        assetRepository.save(ticket.getAsset());
        Ticket saved = ticketRepository.save(ticket);
        notificationService.createNotification(
                "TICKET_ASSIGNED",
                "Ticket đã được nhận xử lý",
                "Ticket #" + saved.getId() + " đã được gán cho " + assignee.getUsername() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Kỹ thuật viên", assignee.getUsername(),
                        "Trạng thái", saved.getStatus(),
                        "Người thao tác", actor.getUsername()
                )
        );
        pushNotification(
                "TICKET_ASSIGNED",
                "Ticket #" + saved.getId() + " đã được gán cho " + assignee.getUsername() + ".",
                saved
        );
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse resolveTicket(Integer ticketId) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if ("RESOLVED".equals(ticket.getStatus())) {
            throw new CustomException("Ticket đã được xử lý trước đó.");
        }
        if (!"IN_PROGRESS".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang IN_PROGRESS mới được hoàn tất.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("TechSupport".equals(actor.getRole())) {
            if (ticket.getAssignee() == null || !actor.getId().equals(ticket.getAssignee().getId())) {
                throw new CustomException("Kỹ thuật viên chỉ được hoàn tất ticket do mình phụ trách.");
            }
        }

        ticket.setStatus("RESOLVED");
        Asset asset = ticket.getAsset();
        asset.setStatus("Sẵn sàng");
        assetRepository.save(asset);
        Ticket saved = ticketRepository.save(ticket);
        notificationService.createNotification(
                "TICKET_RESOLVED",
                "Ticket đã hoàn tất bảo trì",
                actor.getUsername() + " đã hoàn tất ticket #" + saved.getId() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode(),
                        "Trạng thái", saved.getStatus(),
                        "Người thao tác", actor.getUsername()
                )
        );
        pushNotification(
                "TICKET_RESOLVED",
                "Ticket #" + saved.getId() + " đã được xử lý xong.",
                saved
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getTickets(String status, Integer assigneeId) {
        String normalizedStatus = null;
        if (StringUtils.hasText(status)) {
            normalizedStatus = status.trim().toUpperCase();
            if (!List.of("PENDING", "IN_PROGRESS", "RESOLVED").contains(normalizedStatus)) {
                throw new CustomException("status filter không hợp lệ.");
            }
        }

        List<Ticket> tickets;
        if (normalizedStatus != null && assigneeId != null) {
            tickets = ticketRepository.findByStatusAndAssigneeId(normalizedStatus, assigneeId);
        } else if (normalizedStatus != null) {
            tickets = ticketRepository.findByStatus(normalizedStatus);
        } else if (assigneeId != null) {
            tickets = ticketRepository.findByAssigneeId(assigneeId);
        } else {
            tickets = ticketRepository.findAll();
        }
        return tickets.stream()
                .map(this::mapToResponse)
                .toList();
    }

    private LocalDateTime calculateDueDate(String priority, LocalDateTime createdAt) {
        return switch (priority) {
            case "LOW" -> createdAt.plusHours(72);
            case "MEDIUM" -> createdAt.plusHours(48);
            case "HIGH" -> createdAt.plusHours(24);
            default -> createdAt.plusHours(48);
        };
    }

    private TicketResponse mapToResponse(Ticket ticket) {
        String reporterName = StringUtils.hasText(ticket.getReporter().getFullName())
                ? ticket.getReporter().getFullName()
                : ticket.getReporter().getUsername();
        String assigneeName = null;
        if (ticket.getAssignee() != null) {
            assigneeName = StringUtils.hasText(ticket.getAssignee().getFullName())
                    ? ticket.getAssignee().getFullName()
                    : ticket.getAssignee().getUsername();
        }
        return TicketResponse.builder()
                .id(ticket.getId())
                .assetQaCode(ticket.getAsset().getQaCode())
                .reporterId(ticket.getReporter().getId())
                .reporterName(reporterName)
                .reporterRole(ticket.getReporter().getRole())
                .assigneeId(ticket.getAssignee() != null ? ticket.getAssignee().getId() : null)
                .assigneeName(assigneeName)
                .description(ticket.getDescription())
                .imageUrl(ticket.getImageUrl())
                .priority(ticket.getPriority())
                .status(ticket.getStatus())
                .createdAt(ticket.getCreatedAt())
                .dueDate(ticket.getDueDate())
                .build();
    }

    private void pushNotification(String type, String message, Ticket ticket) {
        RealtimeNotificationResponse payload = RealtimeNotificationResponse.builder()
                .type(type)
                .message(message)
                .ticketId(ticket.getId())
                .assetQaCode(ticket.getAsset().getQaCode())
                .status(ticket.getStatus())
                .timestamp(LocalDateTime.now())
                .build();
        simpMessagingTemplate.convertAndSend("/topic/notifications", payload);
    }
}
