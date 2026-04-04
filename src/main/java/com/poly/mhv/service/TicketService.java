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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final AsyncRealtimePushService asyncRealtimePushService;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private final TicketEventService ticketEventService;

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
                .resolvedAt(null)
                .build();

        asset.setStatus("Hỏng");
        assetRepository.save(asset);
        Ticket saved = ticketRepository.save(ticket);
        List<AppUser> eligibleTechSupports = getEligibleTechSupportsByAsset(asset);
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
                saved,
                eligibleTechSupports
        );
        ticketEventService.recordEvent(
                saved,
                "TICKET_CREATED",
                reporter,
                "Tạo ticket mới",
                Map.of(
                        "Trạng thái", toVietnameseStatus(saved.getStatus()),
                        "Mức ưu tiên", toVietnamesePriority(saved.getPriority()),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName()
                )
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
        Integer requiredTechTypeId = getAssetTechTypeId(ticket.getAsset());
        Integer assigneeTechTypeId = assignee.getTechSupportType() != null ? assignee.getTechSupportType().getId() : 0;
        if (requiredTechTypeId > 0 && !requiredTechTypeId.equals(assigneeTechTypeId)) {
            throw new CustomException("Kỹ thuật viên không đúng chuyên môn với loại thiết bị này.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("TechSupport".equals(actor.getRole()) && !actor.getId().equals(assignee.getId())) {
            throw new CustomException("Kỹ thuật viên chỉ được nhận ticket cho chính mình.");
        }
        String previousStatus = ticket.getStatus();

        int changed = ticketRepository.claimTicketIfPending(ticketId, assignee.getId());
        if (changed == 0) {
            throw new CustomException("Ticket đã được nhận xử lý bởi người khác.");
        }
        ticket.setAssignee(assignee);
        ticket.setStatus("IN_PROGRESS");
        ticket.setResolvedAt(null);
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
                        "Trạng thái", toVietnameseStatus("IN_PROGRESS"),
                        "Người thao tác", actor.getUsername()
                )
        );
        pushNotification(
                "TICKET_ASSIGNED",
                "Ticket #" + saved.getId() + " đã được gán cho " + assignee.getUsername() + ".",
                saved
        );
        ticketEventService.recordEvent(
                saved,
                "TICKET_ASSIGNED",
                actor,
                "Gán kỹ thuật viên xử lý",
                Map.of(
                        "Kỹ thuật viên", StringUtils.hasText(assignee.getFullName()) ? assignee.getFullName() : assignee.getUsername(),
                        "Trạng thái", toVietnameseStatus("IN_PROGRESS")
                )
        );
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(previousStatus),
                        "Sang trạng thái", toVietnameseStatus("IN_PROGRESS")
                )
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
        ticket.setResolvedAt(LocalDateTime.now());
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
                        "Trạng thái", toVietnameseStatus(saved.getStatus()),
                        "Người thao tác", actor.getUsername()
                )
        );
        pushNotification(
                "TICKET_RESOLVED",
                "Ticket #" + saved.getId() + " đã được xử lý xong.",
                saved
        );
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus("IN_PROGRESS"),
                        "Sang trạng thái", toVietnameseStatus(saved.getStatus())
                )
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getTickets(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
        String normalizedStatus = null;
        if (StringUtils.hasText(status)) {
            normalizedStatus = status.trim().toUpperCase();
            if (!List.of("PENDING", "IN_PROGRESS", "RESOLVED").contains(normalizedStatus)) {
                throw new CustomException("status filter không hợp lệ.");
            }
        }
        String normalizedAssetQaCode = StringUtils.hasText(assetQaCode) ? assetQaCode.trim() : null;

        AppUser actor = currentUserProvider.getCurrentUser();
        List<Ticket> tickets;
        if (normalizedAssetQaCode != null) {
            tickets = ticketRepository.findByAssetQaCodeOrderByCreatedAtDesc(normalizedAssetQaCode);
        } else if (normalizedStatus != null && assigneeId != null) {
            tickets = ticketRepository.findByStatusAndAssigneeId(normalizedStatus, assigneeId);
        } else if (reporterId != null && normalizedStatus == null && assigneeId == null) {
            tickets = ticketRepository.findByReporterIdOrderByCreatedAtDesc(reporterId);
        } else if (normalizedStatus != null) {
            tickets = ticketRepository.findByStatus(normalizedStatus);
        } else if (assigneeId != null) {
            tickets = ticketRepository.findByAssigneeId(assigneeId);
        } else {
            tickets = ticketRepository.findAll();
        }
        return tickets.stream()
                .filter(ticket -> normalizedAssetQaCode == null || normalizedAssetQaCode.equals(ticket.getAsset().getQaCode()))
                .filter(ticket -> reporterId == null || reporterId.equals(ticket.getReporter().getId()))
                .filter(ticket -> {
                    if (!"TechSupport".equals(actor.getRole())) {
                        return true;
                    }
                    Integer actorTechTypeId = actor.getTechSupportType() != null ? actor.getTechSupportType().getId() : 0;
                    Integer ticketTechTypeId = getAssetTechTypeId(ticket.getAsset());
                    if (ticketTechTypeId <= 0) {
                        return ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId());
                    }
                    return actorTechTypeId.equals(ticketTechTypeId) || (ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId()));
                })
                .sorted(Comparator.comparing(Ticket::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(this::mapToResponse)
                .toList();
    }

    private LocalDateTime calculateDueDate(String priority, LocalDateTime createdAt) {
        return switch (priority) {
            case "LOW" -> createdAt.plusHours(48);
            case "MEDIUM" -> createdAt.plusHours(24);
            case "HIGH" -> createdAt.plusHours(1);
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
                .assetName(ticket.getAsset().getName())
                .assetLocationName(ticket.getAsset().getLocation().getRoomName())
                .assetCategoryName(ticket.getAsset().getCategory().getName())
                .assetCategoryTechTypeId(getAssetTechTypeId(ticket.getAsset()))
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
                .resolvedAt(ticket.getResolvedAt())
                .build();
    }

    private List<AppUser> getEligibleTechSupportsByAsset(Asset asset) {
        Integer techTypeId = getAssetTechTypeId(asset);
        if (techTypeId <= 0) {
            return appUserRepository.findByRole("TechSupport");
        }
        return appUserRepository.findByRoleAndTechSupportTypeId("TechSupport", techTypeId);
    }

    private Integer getAssetTechTypeId(Asset asset) {
        if (asset.getCategory() == null || asset.getCategory().getTechSupportType() == null || asset.getCategory().getTechSupportType().getId() == null) {
            return 0;
        }
        return asset.getCategory().getTechSupportType().getId();
    }

    private String toVietnameseStatus(String status) {
        if ("PENDING".equals(status)) return "Mới báo hỏng";
        if ("IN_PROGRESS".equals(status)) return "Đang xử lý";
        if ("RESOLVED".equals(status)) return "Đã hoàn tất";
        return status;
    }

    private String toVietnamesePriority(String priority) {
        if ("HIGH".equals(priority)) return "Cao";
        if ("LOW".equals(priority)) return "Thấp";
        if ("MEDIUM".equals(priority)) return "Trung bình";
        return priority;
    }

    private void pushNotification(String type, String message, Ticket ticket) {
        pushNotification(type, message, ticket, List.of());
    }

    private void pushNotification(String type, String message, Ticket ticket, List<AppUser> receivers) {
        RealtimeNotificationResponse payload = RealtimeNotificationResponse.builder()
                .type(type)
                .message(message)
                .ticketId(ticket.getId())
                .assetQaCode(ticket.getAsset().getQaCode())
                .status(ticket.getStatus())
                .timestamp(LocalDateTime.now())
                .build();
        if ("TICKET_CREATED".equals(type)) {
            for (AppUser receiver : receivers) {
                asyncRealtimePushService.pushToDestination("/topic/users/" + receiver.getId() + "/notifications", payload);
            }
            for (AppUser admin : appUserRepository.findByRole("Admin")) {
                asyncRealtimePushService.pushToDestination("/topic/users/" + admin.getId() + "/notifications", payload);
            }
            return;
        }
        asyncRealtimePushService.pushToDestination("/topic/notifications", payload);
    }
}
