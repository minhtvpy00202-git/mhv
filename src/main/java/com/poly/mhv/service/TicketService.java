package com.poly.mhv.service;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.notification.RealtimeNotificationResponse;
import com.poly.mhv.dto.ticket.TicketPageResponse;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.dto.ticket.TicketSatisfactionRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.util.AssetStatusSupport;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class TicketService {

    private static final Sort DEFAULT_TICKET_SORT = Sort.by(Sort.Direction.DESC, "createdAt")
            .and(Sort.by(Sort.Direction.DESC, "id"));

    private final TicketRepository ticketRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final AsyncRealtimePushService asyncRealtimePushService;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private final TicketEventService ticketEventService;
    private final TicketImageStorageService ticketImageStorageService;
    private final DashboardService dashboardService;
    private final HelpdeskKpiService helpdeskKpiService;

    @Transactional
    public TicketResponse createTicket(TicketCreateRequest request) {
        return createTicket(request, null);
    }

    @Transactional
    public TicketResponse createTicket(TicketCreateRequest request, MultipartFile imageFile) {
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
        if ("CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode())) {
            throw new CustomException("Vật tư tiêu hao không hỗ trợ báo hỏng và tạo ticket.");
        }
        AppUser reporter = currentUserProvider.getCurrentUser();
        LocalDateTime createdAt = LocalDateTime.now();

        String imageUrl = imageFile != null && !imageFile.isEmpty()
                ? ticketImageStorageService.storeImage(imageFile)
                : ticketImageStorageService.normalizeTicketImageUrl(request.getImageUrl());

        Ticket ticket = Ticket.builder()
                .asset(asset)
                .reporter(reporter)
                .description(request.getDescription().trim())
                .imageUrl(imageUrl)
                .priority(priority)
                .status("PENDING")
                .createdAt(createdAt)
                .dueDate(calculateDueDate(priority, createdAt))
                .acceptedAt(null)
                .resolvedAt(null)
                .satisfactionScore(null)
                .build();

        markAssetBroken(asset, false);
        assetRepository.save(asset);
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        List<AppUser> eligibleTechSupports = getEligibleTechSupportsByAsset(asset);
        String reporterDisplayName = getActorDisplayName(reporter);
        notificationService.createNotification(
                "TICKET_CREATED",
                "Ticket mới cần tiếp nhận",
                reporterDisplayName + " đã tạo ticket #" + saved.getId()
                        + " cho " + asset.getName()
                        + " tại phòng gốc " + asset.getHomeLocation().getRoomName() + ".",
                reporter.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Mức ưu tiên", saved.getPriority(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", reporterDisplayName,
                        "Phòng gốc", asset.getHomeLocation().getRoomName()
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

        Ticket ticket = ticketRepository.findDetailById(ticketId)
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
        if (requiredTechTypeId > 0 && !userHasTechSupportType(assignee, requiredTechTypeId)) {
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
        ticket.setAcceptedAt(LocalDateTime.now());
        markAssetBroken(ticket.getAsset(), true);
        assetRepository.save(ticket.getAsset());
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        String actorDisplayName = getActorDisplayName(actor);
        String assigneeDisplayName = getActorDisplayName(assignee);
        notificationService.createNotification(
                "TICKET_ASSIGNED",
                "Ticket đã được nhận xử lý",
                actorDisplayName + " đã giao ticket #" + saved.getId()
                        + " của " + saved.getAsset().getName()
                        + " cho " + assigneeDisplayName + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Kỹ thuật viên", assigneeDisplayName,
                        "Trạng thái", toVietnameseStatus("IN_PROGRESS"),
                        "Người thao tác", actorDisplayName,
                        "Phòng gốc", saved.getAsset().getHomeLocation().getRoomName()
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

        Ticket ticket = ticketRepository.findDetailById(ticketId)
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
        markAssetGood(asset);
        assetRepository.save(asset);
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "TICKET_RESOLVED",
                "Ticket đã hoàn tất bảo trì",
                actorDisplayName + " đã hoàn tất ticket #" + saved.getId()
                        + " cho " + saved.getAsset().getName()
                        + " tại phòng gốc " + saved.getAsset().getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Trạng thái", toVietnameseStatus(saved.getStatus()),
                        "Người thao tác", actorDisplayName,
                        "Phòng gốc", saved.getAsset().getHomeLocation().getRoomName()
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

    @Transactional
    public TicketResponse rateSatisfaction(Integer ticketId, TicketSatisfactionRequest request) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }
        if (request == null || request.getSatisfactionScore() == null) {
            throw new CustomException("satisfactionScore là bắt buộc.");
        }

        Ticket ticket = ticketRepository.findDetailById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if (!"RESOLVED".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ được chấm điểm hài lòng khi ticket đã hoàn tất.");
        }

        AppUser actor = currentUserProvider.getCurrentUser();
        boolean isAdmin = "Admin".equals(actor.getRole());
        boolean isReporter = ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        if (!isAdmin && !isReporter) {
            throw new CustomException("Bạn không có quyền chấm điểm ticket này.");
        }

        ticket.setSatisfactionScore(request.getSatisfactionScore());
        Ticket saved = ticketRepository.save(ticket);
        helpdeskKpiService.invalidateCaches();
        ticketEventService.recordEvent(
                saved,
                "TICKET_SATISFACTION_RATED",
                actor,
                "Đánh giá mức độ hài lòng",
                Map.of(
                        "Điểm hài lòng", request.getSatisfactionScore(),
                        "Người đánh giá", getActorDisplayName(actor)
                )
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getTickets(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
        TicketFilter normalizedFilter = normalizeFilter(status, assigneeId, assetQaCode, reporterId);
        AppUser actor = currentUserProvider.getCurrentUser();
        return ticketRepository.searchForListing(
                        normalizedFilter.status(),
                        normalizedFilter.assigneeId(),
                        normalizedFilter.assetQaCode(),
                        normalizedFilter.reporterId(),
                        DEFAULT_TICKET_SORT
                ).stream()
                .filter(ticket -> canAccessTicket(actor, ticket))
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TicketPageResponse getAdminTickets(
            int page,
            int size,
            String status,
            Integer assigneeId,
            String assetQaCode,
            Integer reporterId
    ) {
        TicketFilter normalizedFilter = normalizeFilter(status, assigneeId, assetQaCode, reporterId);
        Page<Ticket> ticketPage = ticketRepository.searchForAdmin(
                normalizedFilter.status(),
                normalizedFilter.assigneeId(),
                normalizedFilter.assetQaCode(),
                normalizedFilter.reporterId(),
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)), DEFAULT_TICKET_SORT)
        );
        Map<String, Long> statusCounts = ticketRepository.countByStatusForAdmin(
                        normalizedFilter.status(),
                        normalizedFilter.assigneeId(),
                        normalizedFilter.assetQaCode(),
                        normalizedFilter.reporterId()
                ).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]
                ));
        return TicketPageResponse.builder()
                .items(ticketPage.getContent().stream().map(this::mapToResponse).toList())
                .page(ticketPage.getNumber())
                .size(ticketPage.getSize())
                .totalPages(Math.max(1, ticketPage.getTotalPages()))
                .totalItems(ticketPage.getTotalElements())
                .pendingCount(statusCounts.getOrDefault("PENDING", 0L))
                .inProgressCount(statusCounts.getOrDefault("IN_PROGRESS", 0L))
                .resolvedCount(statusCounts.getOrDefault("RESOLVED", 0L))
                .build();
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketById(Integer ticketId) {
        Ticket ticket = ticketRepository.findDetailById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!canAccessTicket(actor, ticket)) {
            throw new CustomException("Bạn không có quyền truy cập ticket này.");
        }
        return mapToResponse(ticket);
    }

    private TicketFilter normalizeFilter(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
        String normalizedStatus = null;
        if (StringUtils.hasText(status)) {
            normalizedStatus = status.trim().toUpperCase();
            if (!List.of("PENDING", "IN_PROGRESS", "RESOLVED").contains(normalizedStatus)) {
                throw new CustomException("status filter không hợp lệ.");
            }
        }
        String normalizedAssetQaCode = StringUtils.hasText(assetQaCode) ? assetQaCode.trim() : null;
        return new TicketFilter(normalizedStatus, assigneeId, normalizedAssetQaCode, reporterId);
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
                .assetTechnicalStatus(resolveTechnicalStatus(ticket.getAsset()))
                .assetUsageStatus(resolveUsageStatus(ticket.getAsset()))
                .assetDisplayStatus(AssetStatusSupport.deriveDisplayStatus(
                        resolveTechnicalStatus(ticket.getAsset()),
                        resolveUsageStatus(ticket.getAsset()),
                        AssetStatusSupport.isRepairInProgress(ticket.getAsset().getStatus())
                ))
                .reporterId(ticket.getReporter().getId())
                .reporterName(reporterName)
                .reporterRole(ticket.getReporter().getRole())
                .reporterPhone(ticket.getReporter().getPhone())
                .assigneeId(ticket.getAssignee() != null ? ticket.getAssignee().getId() : null)
                .assigneeName(assigneeName)
                .assigneePhone(ticket.getAssignee() != null ? ticket.getAssignee().getPhone() : null)
                .description(ticket.getDescription())
                .imageUrl(ticketImageStorageService.toPublicImageUrl(ticket.getImageUrl()))
                .priority(ticket.getPriority())
                .status(ticket.getStatus())
                .createdAt(ticket.getCreatedAt())
                .dueDate(ticket.getDueDate())
                .acceptedAt(ticket.getAcceptedAt())
                .resolvedAt(ticket.getResolvedAt())
                .satisfactionScore(ticket.getSatisfactionScore())
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

    private boolean userHasTechSupportType(AppUser user, Integer techTypeId) {
        if (user == null || techTypeId == null || techTypeId <= 0) {
            return false;
        }
        if (user.getTechSupportTypes() != null) {
            return user.getTechSupportTypes().stream()
                    .anyMatch(type -> type != null && techTypeId.equals(type.getId()));
        }
        return false;
    }

    private void markAssetBroken(Asset asset, boolean repairInProgress) {
        if (asset == null) {
            return;
        }
        asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_BROKEN);
        asset.setUsageStatus(resolveUsageStatus(asset));
        asset.setStatus(AssetStatusSupport.deriveLegacyStatus(
                asset.getTechnicalStatus(),
                asset.getUsageStatus(),
                repairInProgress
        ));
    }

    private void markAssetGood(Asset asset) {
        if (asset == null) {
            return;
        }
        asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_GOOD);
        asset.setUsageStatus(resolveUsageStatus(asset));
        asset.setStatus(AssetStatusSupport.deriveLegacyStatus(
                asset.getTechnicalStatus(),
                asset.getUsageStatus(),
                false
        ));
    }

    private String resolveUsageStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.USAGE_STATUS_HOME;
        }
        Integer locationId = asset.getLocation() == null ? null : asset.getLocation().getId();
        Integer homeLocationId = asset.getHomeLocation() == null ? null : asset.getHomeLocation().getId();
        return AssetStatusSupport.resolveUsageStatus(
                asset.getUsageStatus(),
                asset.getStatus(),
                locationId,
                homeLocationId
        );
    }

    private String resolveTechnicalStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.TECHNICAL_STATUS_GOOD;
        }
        return AssetStatusSupport.resolveTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
    }

    private boolean canAccessTicket(AppUser actor, Ticket ticket) {
        if (!"TechSupport".equals(actor.getRole())) {
            return true;
        }
        Integer ticketTechTypeId = getAssetTechTypeId(ticket.getAsset());
        if (ticketTechTypeId <= 0) {
            return ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId());
        }
        return userHasTechSupportType(actor, ticketTechTypeId)
                || (ticket.getAssignee() != null && actor.getId().equals(ticket.getAssignee().getId()));
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

    private String getActorDisplayName(AppUser user) {
        return toRoleLabel(user.getRole()) + " " + getFullNameOrUsername(user);
    }

    private String getFullNameOrUsername(AppUser user) {
        return StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private String toRoleLabel(String role) {
        return switch (role) {
            case "Admin" -> "Quản trị viên";
            case "NhanVien" -> "Nhân viên";
            case "TechSupport" -> "Kỹ thuật viên";
            default -> "Người dùng";
        };
    }

    private record TicketFilter(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
    }
}
