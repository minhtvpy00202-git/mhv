package com.poly.mhv.service;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketReasonRequest;
import com.poly.mhv.dto.ticket.TicketResolutionRequest;
import com.poly.mhv.dto.notification.RealtimeNotificationResponse;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.dto.ticket.TicketPageResponse;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.dto.ticket.TicketSatisfactionRequest;
import com.poly.mhv.dto.ticket.TicketExtensionRequest;
import com.poly.mhv.dto.ticket.TicketExtensionReviewRequest;
import com.poly.mhv.dto.ticket.TicketExtensionEventResponse;
import com.poly.mhv.dto.ticket.SuggestedTechnicianResponse;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.util.AssetStatusSupport;
import com.poly.mhv.util.TicketStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class TicketService {

    private static final List<String> ACTIVE_STATUSES = TicketStatusSupport.ACTIVE_STATUSES;
    private static final List<String> EXTENSION_REVIEW_EVENT_TYPES = List.of(
            "EXTENSION_APPROVED", "EXTENSION_REJECTED", "EXTENSION_EXPIRED");
    private static final List<String> EXTENSION_FLOW_EVENT_TYPES = List.of(
            "EXTENSION_REQUESTED",
            "EXTENSION_APPROVED",
            "EXTENSION_REJECTED",
            "EXTENSION_EXPIRED"
    );
    private static final int MAX_EXTENSION_COUNT = 3;
    private static final int CONFIRMATION_WINDOW_HOURS = 72;
    private static final int REOPEN_WINDOW_DAYS = 7;
    private static final Sort DEFAULT_TICKET_SORT = Sort.by(Sort.Direction.DESC, "createdAt")
            .and(Sort.by(Sort.Direction.DESC, "id"));

    private final TicketRepository ticketRepository;
    private final TicketEventRepository ticketEventRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final AsyncRealtimePushService asyncRealtimePushService;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private final TicketEventService ticketEventService;
    private final TicketImageStorageService ticketImageStorageService;
    private final AssetService assetService;
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

        String normalizedQaCode = request.getAssetQaCode().trim();
        String normalizedDescription = request.getDescription().trim();
        if (normalizedQaCode.length() > 20) {
            throw new CustomException("Mã QA thiết bị không được vượt quá 20 ký tự.");
        }
        if (normalizedDescription.length() < 10 || normalizedDescription.length() > 1000) {
            throw new CustomException("Mô tả sự cố phải từ 10 đến 1000 ký tự.");
        }

        Asset asset = assetRepository.findByQaCodeForUpdate(normalizedQaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với asset_qa_code đã cung cấp."));
        if ("CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode())) {
            throw new CustomException("Vật tư tiêu hao không hỗ trợ báo hỏng và tạo ticket.");
        }
        AppUser reporter = currentUserProvider.getCurrentUser();
        if (!List.of("NhanVien", "Admin").contains(reporter.getRole())) {
            throw new CustomException("Vai trò hiện tại không được phép tạo ticket báo hỏng.");
        }
        if (AssetStatusSupport.TECHNICAL_STATUS_LOST.equals(resolveTechnicalStatus(asset))) {
            throw new CustomException("Tài sản đang ở trạng thái Thất lạc nên không thể tạo ticket sửa chữa.");
        }
        if (ticketRepository.existsByAssetQaCodeAndStatusIn(asset.getQaCode(), ACTIVE_STATUSES)) {
            throw new CustomException("Tài sản này đã có ticket đang chờ hoặc đang được xử lý.");
        }
        LocalDateTime createdAt = UtcDateTimes.now();

        SlaRange slaRange = resolveSlaRange(priority, request);

        String imageUrl = imageFile != null && !imageFile.isEmpty()
                ? ticketImageStorageService.storeImage(imageFile)
                : ticketImageStorageService.normalizeTicketImageUrl(request.getImageUrl());

        Ticket ticket = Ticket.builder()
                .asset(asset)
                .reporter(reporter)
                .description(normalizedDescription)
                .imageUrl(imageUrl)
                .priority(priority)
                .status("PENDING")
                .createdAt(createdAt)
                .dueDate(createdAt.plusMinutes(slaRange.maxMinutes()))
                .slaMinMinutes(slaRange.minMinutes())
                .slaMaxMinutes(slaRange.maxMinutes())
                .acceptedAt(null)
                .resolvedAt(null)
                .satisfactionScore(null)
                .assetTechnicalStatusBeforeReport(resolveTechnicalStatus(asset))
                .assetStatusBeforeReport(asset.getStatus())
                .build();

        markAssetBroken(asset, false);
        assetRepository.save(asset);
        assetService.invalidateAssetCaches(asset.getQaCode());
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
                        "Phòng gốc", asset.getHomeLocation().getRoomName()));
        pushNotification(
                "TICKET_CREATED",
                "Ticket #" + saved.getId() + " đã được tạo.",
                saved,
                eligibleTechSupports);
        ticketEventService.recordEvent(
                saved,
                "TICKET_CREATED",
                reporter,
                "Tạo ticket mới",
                Map.of(
                        "Trạng thái", toVietnameseStatus(saved.getStatus()),
                        "Mức ưu tiên", toVietnamesePriority(saved.getPriority()),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName()));
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

        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if (!"PENDING".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket ở trạng thái PENDING mới được gán kỹ thuật viên.");
        }

        AppUser assignee = appUserRepository.findById(request.getAssigneeId())
                .orElseThrow(() -> new CustomException("Không tìm thấy kỹ thuật viên được gán."));
        if (!"TechSupport".equals(assignee.getRole())) {
            throw new CustomException("Người được gán phải có vai trò TechSupport.");
        }
        if (!"Hoạt động".equals(assignee.getStatus())) {
            throw new CustomException("Không thể phân công ticket cho tài khoản kỹ thuật viên đang bị khóa.");
        }
        Integer requiredTechTypeId = getAssetTechTypeId(ticket.getAsset());
        if (requiredTechTypeId > 0 && !userHasTechSupportType(assignee, requiredTechTypeId)) {
            throw new CustomException("Kỹ thuật viên không đúng chuyên môn với loại thiết bị này.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("TechSupport".equals(actor.getRole()) && !actor.getId().equals(assignee.getId())) {
            throw new AccessDeniedException("Kỹ thuật viên chỉ được nhận ticket cho chính mình.");
        }
        String previousStatus = ticket.getStatus();

        int changed = ticketRepository.claimTicketIfPending(ticketId, assignee.getId());
        if (changed == 0) {
            throw new CustomException("Ticket đã được nhận xử lý bởi người khác.");
        }
        ticket.setAssignee(assignee);
        ticket.setStatus("IN_PROGRESS");
        ticket.setResolvedAt(null);
        ticket.setAcceptedAt(UtcDateTimes.now());
        markAssetBroken(ticket.getAsset(), true);
        assetRepository.save(ticket.getAsset());
        assetService.invalidateAssetCaches(ticket.getAsset().getQaCode());
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
                        "Phòng gốc", saved.getAsset().getHomeLocation().getRoomName()),
                ticketNotificationTargets(saved));
        pushNotification(
                "TICKET_ASSIGNED",
                "Ticket #" + saved.getId() + " đã được gán cho " + assignee.getUsername() + ".",
                saved);
        ticketEventService.recordEvent(
                saved,
                "TICKET_ASSIGNED",
                actor,
                "Gán kỹ thuật viên xử lý",
                Map.of(
                        "Kỹ thuật viên",
                        StringUtils.hasText(assignee.getFullName()) ? assignee.getFullName() : assignee.getUsername(),
                        "Trạng thái", toVietnameseStatus("IN_PROGRESS")));
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(previousStatus),
                        "Sang trạng thái", toVietnameseStatus("IN_PROGRESS")));
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse resolveTicket(Integer ticketId, TicketResolutionRequest request) {
        return resolveTicket(ticketId, request, null);
    }

    @Transactional
    public TicketResponse resolveTicket(
            Integer ticketId,
            TicketResolutionRequest request,
            MultipartFile resolutionImageFile) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }
        if (request == null || !StringUtils.hasText(request.getOutcome())) {
            throw new CustomException("Kết quả xử lý là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getNote())) {
            throw new CustomException("Ghi chú xử lý là bắt buộc.");
        }
        String outcome = request.getOutcome().trim().toUpperCase();
        if (!List.of("REPAIRED", "NO_FAULT_FOUND", "UNREPAIRABLE", "REPLACEMENT_REQUIRED").contains(outcome)) {
            throw new CustomException("Kết quả xử lý không hợp lệ.");
        }
        String resolutionNote = request.getNote().trim();
        if (resolutionNote.length() < 10 || resolutionNote.length() > 1000) {
            throw new CustomException("Ghi chú xử lý phải từ 10 đến 1000 ký tự.");
        }

        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if ("RESOLVED".equals(ticket.getStatus())) {
            throw new CustomException("Ticket đã được xử lý trước đó.");
        }
        if (!TicketStatusSupport.isTechnicianWork(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang xử lý hoặc chờ thay thế mới được cập nhật kết quả.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if ("TechSupport".equals(actor.getRole())) {
            if (ticket.getAssignee() == null || !actor.getId().equals(ticket.getAssignee().getId())) {
                throw new AccessDeniedException("Kỹ thuật viên chỉ được cập nhật ticket do mình phụ trách.");
            }
        }

        String previousStatus = ticket.getStatus();
        LocalDateTime actionAt = UtcDateTimes.now();
        String nextStatus = switch (outcome) {
            case "REPAIRED", "NO_FAULT_FOUND" -> TicketStatusSupport.AWAITING_CONFIRMATION;
            case "REPLACEMENT_REQUIRED" -> TicketStatusSupport.WAITING_REPLACEMENT;
            default -> TicketStatusSupport.CLOSED_UNRESOLVED;
        };
        TicketEvent pendingExtension = findLatestExtensionEvent(ticketId);
        if (!TicketStatusSupport.WAITING_REPLACEMENT.equals(nextStatus)
                && pendingExtension != null
                && "EXTENSION_REQUESTED".equals(pendingExtension.getEventType())) {
            ticketEventService.recordEvent(
                    ticket,
                    "EXTENSION_EXPIRED",
                    actor,
                    "Yêu cầu gia hạn tự động hết hiệu lực vì ticket đã rời bước xử lý kỹ thuật.",
                    Map.of("reason", nextStatus));
        }

        ticket.setStatus(nextStatus);
        ticket.setResolutionOutcome(outcome);
        ticket.setResolutionNote(resolutionNote);
        if (resolutionImageFile != null && !resolutionImageFile.isEmpty()) {
            ticket.setResolutionImageUrl(ticketImageStorageService.storeImage(resolutionImageFile));
        }
        if (TicketStatusSupport.AWAITING_CONFIRMATION.equals(nextStatus)) {
            ticket.setResolvedAt(actionAt);
            ticket.setConfirmationDueAt(actionAt.plusHours(CONFIRMATION_WINDOW_HOURS));
            ticket.setConfirmedAt(null);
            ticket.setClosedAt(null);
            ticket.setClosedReason(null);
        } else if (TicketStatusSupport.WAITING_REPLACEMENT.equals(nextStatus)) {
            ticket.setResolvedAt(null);
            ticket.setConfirmationDueAt(null);
            ticket.setConfirmedAt(null);
            ticket.setClosedAt(null);
            ticket.setClosedReason(null);
        } else {
            ticket.setResolvedAt(null);
            ticket.setConfirmationDueAt(null);
            ticket.setConfirmedAt(null);
            ticket.setClosedAt(actionAt);
            ticket.setClosedReason("Thiết bị được kết luận không thể sửa chữa.");
        }
        Asset asset = assetRepository.findByQaCodeForUpdate(ticket.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản của ticket."));
        boolean repaired = List.of("REPAIRED", "NO_FAULT_FOUND").contains(outcome);
        if (repaired && !hasOtherActiveTicket(asset.getQaCode(), ticket.getId())) {
            markAssetGood(asset);
        } else {
            markAssetBroken(asset, hasOtherInProgressTicket(asset.getQaCode(), ticket.getId()));
        }
        assetRepository.save(asset);
        assetService.invalidateAssetCaches(asset.getQaCode());
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        String actorDisplayName = getActorDisplayName(actor);
        String eventType = switch (nextStatus) {
            case TicketStatusSupport.AWAITING_CONFIRMATION -> "TICKET_RESOLUTION_SUBMITTED";
            case TicketStatusSupport.WAITING_REPLACEMENT -> "TICKET_REPLACEMENT_REQUIRED";
            default -> "TICKET_CLOSED_UNRESOLVED";
        };
        String notificationTitle = switch (nextStatus) {
            case TicketStatusSupport.AWAITING_CONFIRMATION -> "Kết quả xử lý đang chờ xác nhận";
            case TicketStatusSupport.WAITING_REPLACEMENT -> "Ticket đang chờ thay thế thiết bị";
            default -> "Ticket đã đóng với kết quả không thể sửa chữa";
        };
        notificationService.createNotification(
                eventType,
                notificationTitle,
                actorDisplayName + " đã cập nhật kết quả ticket #" + saved.getId()
                        + " cho " + saved.getAsset().getName()
                        + " tại phòng gốc " + saved.getAsset().getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Trạng thái", toVietnameseStatus(saved.getStatus()),
                        "Kết quả", toVietnameseResolutionOutcome(outcome),
                        "Người thao tác", actorDisplayName,
                        "Phòng gốc", saved.getAsset().getHomeLocation().getRoomName()),
                ticketNotificationTargets(saved));
        pushNotification(
                eventType,
                "Ticket #" + saved.getId() + " đã chuyển sang " + toVietnameseStatus(nextStatus) + ".",
                saved);
        ticketEventService.recordEvent(
                saved,
                eventType,
                actor,
                "Ghi nhận kết quả xử lý",
                Map.of(
                        "Kết quả", toVietnameseResolutionOutcome(outcome),
                        "Ghi chú", resolutionNote,
                        "Trạng thái", toVietnameseStatus(nextStatus)));
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(previousStatus),
                        "Sang trạng thái", toVietnameseStatus(saved.getStatus())));
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse confirmResolution(Integer ticketId) {
        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureReporter(actor, ticket, "Chỉ người báo ticket mới được xác nhận kết quả xử lý.");
        if (!TicketStatusSupport.AWAITING_CONFIRMATION.equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang chờ xác nhận mới có thể được xác nhận hoàn tất.");
        }
        return mapToResponse(completeResolutionConfirmation(ticket, actor, false));
    }

    @Transactional
    public TicketResponse rejectResolution(Integer ticketId, TicketReasonRequest request) {
        Ticket ticket = getTicketForLifecycleChange(ticketId, request);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureReporter(actor, ticket, "Chỉ người báo ticket mới được từ chối kết quả xử lý.");
        if (!TicketStatusSupport.AWAITING_CONFIRMATION.equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang chờ xác nhận mới có thể yêu cầu xử lý lại.");
        }

        String reason = request.getReason().trim();
        Map<String, Object> rejectedResult = new LinkedHashMap<>();
        rejectedResult.put("Lý do", reason);
        rejectedResult.put("Kết quả kỹ thuật", toVietnameseResolutionOutcome(ticket.getResolutionOutcome()));
        rejectedResult.put("Ghi chú kỹ thuật", ticket.getResolutionNote());

        ticket.setStatus(TicketStatusSupport.IN_PROGRESS);
        ticket.setResolvedAt(null);
        ticket.setClosedAt(null);
        ticket.setClosedReason(null);
        ticket.setConfirmationDueAt(null);
        ticket.setConfirmedAt(null);
        ticket.setResolutionOutcome(null);
        ticket.setResolutionNote(null);
        ticket.setResolutionImageUrl(null);

        Asset asset = assetRepository.findByQaCodeForUpdate(ticket.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản của ticket."));
        markAssetBroken(asset, true);
        assetRepository.save(asset);
        assetService.invalidateAssetCaches(asset.getQaCode());
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();

        ticketEventService.recordEvent(
                saved,
                "TICKET_RESOLUTION_REJECTED",
                actor,
                "Người báo yêu cầu tiếp tục xử lý",
                rejectedResult);
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(TicketStatusSupport.AWAITING_CONFIRMATION),
                        "Sang trạng thái", toVietnameseStatus(TicketStatusSupport.IN_PROGRESS)));
        notificationService.createNotification(
                "TICKET_RESOLUTION_REJECTED",
                "Người báo yêu cầu xử lý lại ticket #" + saved.getId(),
                getActorDisplayName(actor) + " chưa xác nhận kết quả và yêu cầu tiếp tục xử lý ticket #"
                        + saved.getId() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of("Ticket", "#" + saved.getId(), "Lý do", reason),
                ticketNotificationTargets(saved));
        pushNotification(
                "TICKET_RESOLUTION_REJECTED",
                "Ticket #" + saved.getId() + " cần được tiếp tục xử lý.",
                saved);
        return mapToResponse(saved);
    }

    @Transactional
    public int autoCloseExpiredConfirmations() {
        LocalDateTime now = UtcDateTimes.now();
        List<Integer> candidateIds = ticketRepository
                .findByStatusAndConfirmationDueAtLessThanEqual(TicketStatusSupport.AWAITING_CONFIRMATION, now)
                .stream()
                .map(Ticket::getId)
                .toList();
        int closedCount = 0;
        for (Integer ticketId : candidateIds) {
            Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId).orElse(null);
            if (ticket == null
                    || !TicketStatusSupport.AWAITING_CONFIRMATION.equals(ticket.getStatus())
                    || ticket.getConfirmationDueAt() == null
                    || ticket.getConfirmationDueAt().isAfter(now)) {
                continue;
            }
            completeResolutionConfirmation(ticket, null, true);
            closedCount++;
        }
        return closedCount;
    }

    private Ticket completeResolutionConfirmation(Ticket ticket, AppUser actor, boolean automatic) {
        LocalDateTime closedAt = UtcDateTimes.now();
        ticket.setStatus(TicketStatusSupport.RESOLVED);
        ticket.setClosedAt(closedAt);
        ticket.setClosedReason(automatic
                ? "Hệ thống tự động đóng sau " + CONFIRMATION_WINDOW_HOURS + " giờ không có phản hồi."
                : null);
        ticket.setConfirmedAt(automatic ? null : closedAt);
        ticket.setConfirmationDueAt(null);
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();

        String eventType = automatic ? "TICKET_AUTO_CONFIRMED" : "TICKET_RESOLUTION_CONFIRMED";
        String actorName = automatic ? "Hệ thống" : getActorDisplayName(actor);
        ticketEventService.recordEvent(
                saved,
                eventType,
                actor,
                automatic ? "Tự động đóng ticket sau thời hạn xác nhận" : "Người báo xác nhận kết quả xử lý",
                Map.of("Trạng thái", toVietnameseStatus(TicketStatusSupport.RESOLVED)));
        ticketEventService.recordEvent(
                saved,
                "TICKET_STATUS_CHANGED",
                actor,
                "Cập nhật trạng thái ticket",
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(TicketStatusSupport.AWAITING_CONFIRMATION),
                        "Sang trạng thái", toVietnameseStatus(TicketStatusSupport.RESOLVED)));
        notificationService.createNotification(
                eventType,
                automatic ? "Ticket tự động hoàn tất" : "Kết quả xử lý đã được xác nhận",
                actorName + " đã xác nhận hoàn tất ticket #" + saved.getId() + ".",
                automatic ? "system" : actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Trạng thái", toVietnameseStatus(saved.getStatus())),
                ticketNotificationTargets(saved));
        pushNotification(eventType, "Ticket #" + saved.getId() + " đã hoàn tất.", saved);
        return saved;
    }

    private void ensureReporter(AppUser actor, Ticket ticket, String message) {
        boolean isReporter = actor != null
                && ticket.getReporter() != null
                && actor.getId().equals(ticket.getReporter().getId());
        if (!isReporter) {
            throw new AccessDeniedException(message);
        }
    }

    @Transactional
    public TicketResponse reassignTicket(Integer ticketId, TicketAssignRequest request) {
        if (ticketId == null || request == null || request.getAssigneeId() == null) {
            throw new CustomException("Ticket và kỹ thuật viên được chuyển giao là bắt buộc.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin mới được chuyển người xử lý ticket.");
        }
        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if (!TicketStatusSupport.isTechnicianWork(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang xử lý hoặc chờ thay thế mới được chuyển kỹ thuật viên.");
        }
        AppUser assignee = getEligibleActiveAssignee(ticket, request.getAssigneeId());
        if (ticket.getAssignee() != null && assignee.getId().equals(ticket.getAssignee().getId())) {
            throw new CustomException("Ticket đã được giao cho kỹ thuật viên này.");
        }
        String previousAssignee = ticket.getAssignee() == null
                ? "Chưa phân công"
                : getFullNameOrUsername(ticket.getAssignee());
        TicketEvent pendingExtension = findLatestExtensionEvent(ticketId);
        if (pendingExtension != null && "EXTENSION_REQUESTED".equals(pendingExtension.getEventType())) {
            ticketEventService.recordEvent(
                    ticket,
                    "EXTENSION_EXPIRED",
                    actor,
                    "Yêu cầu gia hạn hết hiệu lực vì ticket được chuyển kỹ thuật viên.",
                    Map.of("reason", "REASSIGNED", "previousAssignee", previousAssignee));
        }
        ticket.setAssignee(assignee);
        ticket.setAcceptedAt(UtcDateTimes.now());
        Ticket saved = ticketRepository.save(ticket);
        helpdeskKpiService.invalidateCaches();
        ticketEventService.recordEvent(
                saved,
                "TICKET_REASSIGNED",
                actor,
                "Chuyển kỹ thuật viên xử lý",
                Map.of(
                        "Từ kỹ thuật viên", previousAssignee,
                        "Sang kỹ thuật viên", getFullNameOrUsername(assignee)));
        notificationService.createNotification(
                "TICKET_REASSIGNED",
                "Ticket đã đổi kỹ thuật viên phụ trách",
                "Ticket #" + saved.getId() + " đã được chuyển từ " + previousAssignee
                        + " sang " + getFullNameOrUsername(assignee) + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Từ kỹ thuật viên", previousAssignee,
                        "Sang kỹ thuật viên", getFullNameOrUsername(assignee)),
                ticketNotificationTargets(saved));
        pushNotification(
                "TICKET_REASSIGNED",
                "Ticket #" + saved.getId() + " đã được chuyển cho " + getFullNameOrUsername(assignee) + ".",
                saved);
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse cancelTicket(Integer ticketId, TicketReasonRequest request) {
        Ticket ticket = getTicketForLifecycleChange(ticketId, request);
        AppUser actor = currentUserProvider.getCurrentUser();
        boolean isAdmin = "Admin".equals(actor.getRole());
        boolean isReporter = ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        if (!isAdmin && !isReporter) {
            throw new AccessDeniedException("Bạn không có quyền hủy ticket này.");
        }
        if (isReporter && !"PENDING".equals(ticket.getStatus())) {
            throw new CustomException("Người báo chỉ được hủy ticket khi chưa có kỹ thuật viên tiếp nhận.");
        }
        if (!ACTIVE_STATUSES.contains(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket đang hoạt động mới được hủy.");
        }
        return closeTicket(ticket, actor, "CANCELLED", request.getReason().trim(), "TICKET_CANCELLED");
    }

    @Transactional
    public TicketResponse rejectTicket(Integer ticketId, TicketReasonRequest request) {
        Ticket ticket = getTicketForLifecycleChange(ticketId, request);
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin mới được từ chối ticket.");
        }
        if (!"PENDING".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ ticket chưa tiếp nhận mới được từ chối.");
        }
        return closeTicket(ticket, actor, "REJECTED", request.getReason().trim(), "TICKET_REJECTED");
    }

    @Transactional
    public TicketResponse reopenTicket(Integer ticketId, TicketReasonRequest request) {
        Ticket original = getTicketForLifecycleChange(ticketId, request);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureReporter(actor, original, "Chỉ người báo ticket mới được mở lại sự cố.");
        if (!TicketStatusSupport.RESOLVED.equals(original.getStatus())) {
            throw new CustomException("Chỉ ticket đã hoàn tất mới được mở lại.");
        }

        LocalDateTime completedAt = original.getClosedAt() != null
                ? original.getClosedAt()
                : original.getResolvedAt();
        if (completedAt == null || UtcDateTimes.now().isAfter(completedAt.plusDays(REOPEN_WINDOW_DAYS))) {
            throw new CustomException("Đã hết thời hạn " + REOPEN_WINDOW_DAYS
                    + " ngày để mở lại ticket. Vui lòng tạo báo hỏng mới.");
        }
        Ticket latestTicket = ticketRepository
                .findFirstByAssetQaCodeOrderByCreatedAtDescIdDesc(original.getAsset().getQaCode())
                .orElse(original);
        if (!original.getId().equals(latestTicket.getId())) {
            throw new CustomException("Chỉ ticket gần nhất của tài sản mới được mở lại.");
        }
        if (ticketRepository.existsByReopenedFromTicketId(original.getId())) {
            throw new CustomException("Ticket này đã được mở lại trước đó.");
        }

        Asset asset = assetRepository.findByQaCodeForUpdate(original.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản của ticket."));
        if (ticketRepository.existsByAssetQaCodeAndStatusIn(asset.getQaCode(), ACTIVE_STATUSES)) {
            throw new CustomException("Tài sản này đã có ticket đang hoạt động nên không thể mở lại ticket cũ.");
        }
        int minSla = original.getSlaMinMinutes() != null
                ? original.getSlaMinMinutes()
                : defaultSlaRange(original.getPriority()).minMinutes();
        int maxSla = original.getSlaMaxMinutes() != null
                ? original.getSlaMaxMinutes()
                : defaultSlaRange(original.getPriority()).maxMinutes();
        LocalDateTime createdAt = UtcDateTimes.now();
        String reopenedDescription = "Mở lại ticket #" + original.getId() + ": " + request.getReason().trim()
                + ". Sự cố ban đầu: " + original.getDescription();
        if (reopenedDescription.length() > 1000) {
            reopenedDescription = reopenedDescription.substring(0, 1000);
        }
        Ticket reopened = Ticket.builder()
                .asset(asset)
                .reporter(original.getReporter())
                .description(reopenedDescription)
                .imageUrl(original.getImageUrl())
                .priority(original.getPriority())
                .status("PENDING")
                .createdAt(createdAt)
                .dueDate(createdAt.plusMinutes(maxSla))
                .slaMinMinutes(minSla)
                .slaMaxMinutes(maxSla)
                .assetTechnicalStatusBeforeReport(resolveTechnicalStatus(asset))
                .assetStatusBeforeReport(asset.getStatus())
                .reopenedFromTicketId(original.getId())
                .build();
        markAssetBroken(asset, false);
        assetRepository.save(asset);
        assetService.invalidateAssetCaches(asset.getQaCode());
        Ticket saved = ticketRepository.save(reopened);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        ticketEventService.recordEvent(
                original,
                "TICKET_REOPENED",
                actor,
                "Mở lại ticket bằng một ticket mới",
                Map.of("Ticket mới", "#" + saved.getId(), "Lý do", request.getReason().trim()));
        ticketEventService.recordEvent(
                saved,
                "TICKET_CREATED",
                actor,
                "Tạo ticket mở lại",
                Map.of("Ticket gốc", "#" + original.getId(), "Lý do", request.getReason().trim()));
        notificationService.createNotification(
                "TICKET_REOPENED",
                "Ticket được mở lại",
                "Ticket #" + saved.getId() + " được mở lại từ ticket #" + original.getId() + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket mới", "#" + saved.getId(),
                        "Ticket gốc", "#" + original.getId(),
                        "Lý do", request.getReason().trim()),
                ticketNotificationTargets(saved));
        pushNotification(
                "TICKET_CREATED",
                "Ticket #" + saved.getId() + " được mở lại từ ticket #" + original.getId() + ".",
                saved,
                getEligibleTechSupportsByAsset(asset));
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

        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        if (!"RESOLVED".equals(ticket.getStatus())) {
            throw new CustomException("Chỉ được chấm điểm hài lòng khi ticket đã hoàn tất.");
        }
        if (ticket.getSatisfactionScore() != null) {
            throw new CustomException("Ticket này đã được đánh giá trước đó.");
        }

        AppUser actor = currentUserProvider.getCurrentUser();
        boolean isReporter = ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        if (!isReporter) {
            throw new AccessDeniedException("Chỉ người báo ticket mới được chấm điểm hài lòng.");
        }

        ticket.setSatisfactionScore(request.getSatisfactionScore());
        String normalizedComment = StringUtils.hasText(request.getSatisfactionComment())
                ? request.getSatisfactionComment().trim()
                : null;
        ticket.setSatisfactionComment(normalizedComment);
        Ticket saved = ticketRepository.save(ticket);
        helpdeskKpiService.invalidateCaches();
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("Điểm hài lòng", request.getSatisfactionScore());
        detail.put("Người đánh giá", getActorDisplayName(actor));
        if (normalizedComment != null) {
            detail.put("Nhận xét", normalizedComment);
        }
        ticketEventService.recordEvent(
                saved,
                "TICKET_SATISFACTION_RATED",
                actor,
                "Đánh giá mức độ hài lòng",
                detail);
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getMyPendingSatisfactionTickets() {
        AppUser actor = currentUserProvider.getCurrentUser();
        return ticketRepository.findPendingSatisfactionByReporterId(actor.getId()).stream()
                .map(this::mapToResponse)
                .toList();
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
                DEFAULT_TICKET_SORT).stream()
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
            Integer reporterId) {
        TicketFilter normalizedFilter = normalizeFilter(status, assigneeId, assetQaCode, reporterId);
        Page<Ticket> ticketPage = ticketRepository.searchForAdmin(
                normalizedFilter.status(),
                normalizedFilter.assigneeId(),
                normalizedFilter.assetQaCode(),
                normalizedFilter.reporterId(),
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)), DEFAULT_TICKET_SORT));
        Map<String, Long> statusCounts = ticketRepository.countByStatusForAdmin(
                normalizedFilter.status(),
                normalizedFilter.assigneeId(),
                normalizedFilter.assetQaCode(),
                normalizedFilter.reporterId()).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]));
        return TicketPageResponse.builder()
                .items(ticketPage.getContent().stream().map(this::mapToResponse).toList())
                .page(ticketPage.getNumber())
                .size(ticketPage.getSize())
                .totalPages(Math.max(1, ticketPage.getTotalPages()))
                .totalItems(ticketPage.getTotalElements())
                .pendingCount(statusCounts.getOrDefault("PENDING", 0L))
                .inProgressCount(statusCounts.getOrDefault("IN_PROGRESS", 0L))
                .awaitingConfirmationCount(statusCounts.getOrDefault("AWAITING_CONFIRMATION", 0L))
                .waitingReplacementCount(statusCounts.getOrDefault("WAITING_REPLACEMENT", 0L))
                .resolvedCount(statusCounts.getOrDefault("RESOLVED", 0L))
                .closedUnresolvedCount(statusCounts.getOrDefault("CLOSED_UNRESOLVED", 0L))
                .build();
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketById(Integer ticketId) {
        Ticket ticket = ticketRepository.findDetailById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!canAccessTicket(actor, ticket)) {
            throw new AccessDeniedException("Bạn không có quyền truy cập ticket này.");
        }
        return mapToResponse(ticket);
    }

    private TicketFilter normalizeFilter(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
        String normalizedStatus = null;
        if (StringUtils.hasText(status)) {
            normalizedStatus = status.trim().toUpperCase();
            if (!TicketStatusSupport.FILTERABLE_STATUSES.contains(normalizedStatus)) {
                throw new CustomException("status filter không hợp lệ.");
            }
        }
        String normalizedAssetQaCode = StringUtils.hasText(assetQaCode) ? assetQaCode.trim() : null;
        return new TicketFilter(normalizedStatus, assigneeId, normalizedAssetQaCode, reporterId);
    }

    private SlaRange resolveSlaRange(String priority, TicketCreateRequest request) {
        int allowedMin = switch (priority) {
            case "HIGH" -> 10;
            case "MEDIUM" -> 240;
            default -> 2880;
        };
        int allowedMax = switch (priority) {
            case "HIGH" -> 240;
            case "MEDIUM" -> 2880;
            default -> 5040;
        };
        int defaultMin = switch (priority) {
            case "HIGH" -> 30;
            case "MEDIUM" -> 720;
            default -> 3600;
        };
        int defaultMax = switch (priority) {
            case "HIGH" -> 120;
            case "MEDIUM" -> 1440;
            default -> 4320;
        };

        Integer custom = request.getCustomSlaMinutes();
        Integer requestedMin = request.getMinSlaMinutes();
        Integer requestedMax = request.getMaxSlaMinutes();
        if (custom != null && (requestedMin != null || requestedMax != null)) {
            throw new CustomException("Chỉ được chọn SLA tùy chỉnh hoặc khoảng SLA, không được gửi đồng thời.");
        }
        if ((requestedMin == null) != (requestedMax == null)) {
            throw new CustomException("Phải cung cấp đồng thời SLA tối thiểu và tối đa.");
        }
        if (custom != null) {
            requestedMin = custom;
            requestedMax = custom;
        }
        int minMinutes = requestedMin == null ? defaultMin : requestedMin;
        int maxMinutes = requestedMax == null ? defaultMax : requestedMax;
        if (minMinutes < allowedMin || maxMinutes > allowedMax || minMinutes > maxMinutes) {
            throw new CustomException("Khoảng SLA không hợp lệ với mức ưu tiên " + priority + ".");
        }
        return new SlaRange(minMinutes, maxMinutes);
    }

    private SlaRange defaultSlaRange(String priority) {
        return switch (priority == null ? "" : priority.trim().toUpperCase()) {
            case "HIGH" -> new SlaRange(30, 120);
            case "LOW" -> new SlaRange(3600, 4320);
            default -> new SlaRange(720, 1440);
        };
    }

    private Ticket getTicketForLifecycleChange(Integer ticketId, TicketReasonRequest request) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }
        if (request == null || !StringUtils.hasText(request.getReason())) {
            throw new CustomException("Lý do là bắt buộc.");
        }
        String reason = request.getReason().trim();
        if (reason.length() < 10 || reason.length() > 1000) {
            throw new CustomException("Lý do phải từ 10 đến 1000 ký tự.");
        }
        return ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));
    }

    private TicketResponse closeTicket(
            Ticket ticket,
            AppUser actor,
            String nextStatus,
            String reason,
            String eventType) {
        TicketEvent pendingExtension = findLatestExtensionEvent(ticket.getId());
        if (pendingExtension != null && "EXTENSION_REQUESTED".equals(pendingExtension.getEventType())) {
            ticketEventService.recordEvent(
                    ticket,
                    "EXTENSION_EXPIRED",
                    actor,
                    "Yêu cầu gia hạn tự động hết hiệu lực vì ticket đã đóng.",
                    Map.of("reason", nextStatus));
        }
        String previousStatus = ticket.getStatus();
        LocalDateTime closedAt = UtcDateTimes.now();
        ticket.setStatus(nextStatus);
        ticket.setClosedAt(closedAt);
        ticket.setClosedReason(reason);
        ticket.setResolvedAt(null);
        ticket.setResolutionOutcome(null);
        ticket.setResolutionNote(null);
        ticket.setResolutionImageUrl(null);
        ticket.setConfirmationDueAt(null);
        ticket.setConfirmedAt(null);

        Asset asset = assetRepository.findByQaCodeForUpdate(ticket.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản của ticket."));
        if (hasOtherActiveTicket(asset.getQaCode(), ticket.getId())) {
            markAssetBroken(asset, hasOtherInProgressTicket(asset.getQaCode(), ticket.getId()));
        } else if ("CANCELLED".equals(nextStatus)
                && !TicketStatusSupport.PENDING.equals(previousStatus)) {
            markAssetBroken(asset, false);
        } else {
            restoreAssetBeforeReport(ticket, asset);
        }
        assetRepository.save(asset);
        assetService.invalidateAssetCaches(asset.getQaCode());
        Ticket saved = ticketRepository.save(ticket);
        dashboardService.invalidateSummaryCache();
        helpdeskKpiService.invalidateCaches();
        ticketEventService.recordEvent(
                saved,
                eventType,
                actor,
                "Đóng ticket với trạng thái " + toVietnameseStatus(nextStatus),
                Map.of(
                        "Từ trạng thái", toVietnameseStatus(previousStatus),
                        "Sang trạng thái", toVietnameseStatus(nextStatus),
                        "Lý do", reason));
        notificationService.createNotification(
                eventType,
                "Ticket đã " + ("REJECTED".equals(nextStatus) ? "bị từ chối" : "được hủy"),
                "Ticket #" + saved.getId() + " đã chuyển sang " + toVietnameseStatus(nextStatus) + ".",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Ticket", "#" + saved.getId(),
                        "Trạng thái", toVietnameseStatus(nextStatus),
                        "Lý do", reason),
                ticketNotificationTargets(saved));
        pushNotification(
                eventType,
                "Ticket #" + saved.getId() + " đã chuyển sang " + toVietnameseStatus(nextStatus) + ".",
                saved);
        return mapToResponse(saved);
    }

    private AppUser getEligibleActiveAssignee(Ticket ticket, Integer assigneeId) {
        AppUser assignee = appUserRepository.findById(assigneeId)
                .orElseThrow(() -> new CustomException("Không tìm thấy kỹ thuật viên được gán."));
        if (!"TechSupport".equals(assignee.getRole())) {
            throw new CustomException("Người được gán phải có vai trò TechSupport.");
        }
        if (!"Hoạt động".equals(assignee.getStatus())) {
            throw new CustomException("Không thể phân công ticket cho tài khoản kỹ thuật viên đang bị khóa.");
        }
        Integer requiredTechTypeId = getAssetTechTypeId(ticket.getAsset());
        if (requiredTechTypeId > 0 && !userHasTechSupportType(assignee, requiredTechTypeId)) {
            throw new CustomException("Kỹ thuật viên không đúng chuyên môn với loại thiết bị này.");
        }
        return assignee;
    }

    private boolean hasOtherActiveTicket(String assetQaCode, Integer excludedTicketId) {
        return ticketRepository.findByAssetQaCodeAndStatusIn(assetQaCode, ACTIVE_STATUSES).stream()
                .anyMatch(item -> !item.getId().equals(excludedTicketId));
    }

    private boolean hasOtherInProgressTicket(String assetQaCode, Integer excludedTicketId) {
        return ticketRepository.findByAssetQaCodeAndStatusIn(
                        assetQaCode,
                        List.of(TicketStatusSupport.IN_PROGRESS, TicketStatusSupport.WAITING_REPLACEMENT)).stream()
                .anyMatch(item -> !item.getId().equals(excludedTicketId));
    }

    private void restoreAssetBeforeReport(Ticket ticket, Asset asset) {
        if (StringUtils.hasText(ticket.getAssetTechnicalStatusBeforeReport())) {
            asset.setTechnicalStatus(AssetStatusSupport.normalizeTechnicalStatus(
                    ticket.getAssetTechnicalStatusBeforeReport()));
            asset.setUsageStatus(resolveUsageStatus(asset));
            asset.setStatus(StringUtils.hasText(ticket.getAssetStatusBeforeReport())
                    ? ticket.getAssetStatusBeforeReport()
                    : AssetStatusSupport.deriveLegacyStatus(asset.getTechnicalStatus(), asset.getUsageStatus(), false));
            return;
        }
        if (StringUtils.hasText(ticket.getAssetStatusBeforeReport())) {
            asset.setStatus(ticket.getAssetStatusBeforeReport());
            asset.setTechnicalStatus(AssetStatusSupport.resolveTechnicalStatus(
                    asset.getTechnicalStatus(), ticket.getAssetStatusBeforeReport()));
            asset.setUsageStatus(resolveUsageStatus(asset));
            return;
        }
        markAssetBroken(asset, false);
    }

    private int getMaxExtensionMinutes(String priority) {
        return switch (priority == null ? "" : priority.trim().toUpperCase()) {
            case "HIGH" -> 240;
            case "LOW" -> 2880;
            default -> 1440;
        };
    }

    private ExtensionStats getExtensionStats(Integer ticketId) {
        if (ticketId == null) {
            return new ExtensionStats(0, 0);
        }
        List<TicketEvent> approvedEvents = ticketEventRepository
                .findByTicketIdAndEventTypeOrderByOccurredAtAscIdAsc(ticketId, "EXTENSION_APPROVED");
        int totalMinutes = approvedEvents.stream()
                .mapToInt(this::parseRequestedMinutes)
                .filter(value -> value > 0)
                .sum();
        return new ExtensionStats(approvedEvents.size(), totalMinutes);
    }

    private int parseRequestedMinutes(TicketEvent event) {
        if (event == null) {
            return 0;
        }
        try {
            String detailText = event.getDetailJson();
            if (StringUtils.hasText(detailText)) {
                for (String line : detailText.split("\n")) {
                    if (line.startsWith("requestedMinutes: ")) {
                        return Integer.parseInt(line.substring(18).trim());
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // Fall back to the human-readable event message for legacy rows.
        }
        try {
            String message = event.getMessage();
            int start = message == null ? -1 : message.indexOf("Xin thêm ");
            int end = start < 0 ? -1 : message.indexOf(" phút", start);
            return start >= 0 && end > start
                    ? Integer.parseInt(message.substring(start + 9, end).trim())
                    : 0;
        } catch (RuntimeException ignored) {
            return 0;
        }
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

        String rawDesc = ticket.getDescription() != null ? ticket.getDescription() : "";
        String cleanDesc = rawDesc;
        Integer minSla = ticket.getSlaMinMinutes();
        Integer maxSla = ticket.getSlaMaxMinutes();
        if (rawDesc.contains("[SLA_RANGE:")) {
            int start = rawDesc.indexOf("[SLA_RANGE:");
            int end = rawDesc.indexOf("]", start);
            if (end > start) {
                String rangeStr = rawDesc.substring(start + 11, end);
                String[] parts = rangeStr.split(":");
                if ((minSla == null || maxSla == null) && parts.length == 2) {
                    try {
                        minSla = Integer.parseInt(parts[0]);
                        maxSla = Integer.parseInt(parts[1]);
                    } catch (NumberFormatException e) {
                        // ignore
                    }
                }
                cleanDesc = rawDesc.substring(0, start).trim();
            }
        }

        if (minSla == null && ticket.getCreatedAt() != null && ticket.getDueDate() != null) {
            long diffMins = java.time.Duration.between(ticket.getCreatedAt(), ticket.getDueDate()).toMinutes();
            minSla = (int) Math.max(1, diffMins);
            maxSla = minSla;
        }

        ExtensionStats extensionStats = getExtensionStats(ticket.getId());
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
                        AssetStatusSupport.isRepairInProgress(ticket.getAsset().getStatus())))
                .reporterId(ticket.getReporter().getId())
                .reporterName(reporterName)
                .reporterRole(ticket.getReporter().getRole())
                .reporterPhone(ticket.getReporter().getPhone())
                .assigneeId(ticket.getAssignee() != null ? ticket.getAssignee().getId() : null)
                .assigneeName(assigneeName)
                .assigneePhone(ticket.getAssignee() != null ? ticket.getAssignee().getPhone() : null)
                .description(cleanDesc)
                .imageUrl(ticketImageStorageService.toPublicImageUrl(ticket.getImageUrl()))
                .priority(ticket.getPriority())
                .status(ticket.getStatus())
                .createdAt(ticket.getCreatedAt())
                .dueDate(ticket.getDueDate())
                .acceptedAt(ticket.getAcceptedAt())
                .resolvedAt(ticket.getResolvedAt())
                .closedAt(ticket.getClosedAt())
                .closedReason(ticket.getClosedReason())
                .confirmationDueAt(ticket.getConfirmationDueAt())
                .confirmedAt(ticket.getConfirmedAt())
                .resolutionOutcome(ticket.getResolutionOutcome())
                .resolutionNote(ticket.getResolutionNote())
                .resolutionImageUrl(ticketImageStorageService.toPublicImageUrl(ticket.getResolutionImageUrl()))
                .reopenedFromTicketId(ticket.getReopenedFromTicketId())
                .satisfactionScore(ticket.getSatisfactionScore())
                .satisfactionComment(ticket.getSatisfactionComment())
                .minSlaMinutes(minSla)
                .maxSlaMinutes(maxSla)
                .approvedExtensionCount(extensionStats.approvedCount())
                .maxExtensionCount(MAX_EXTENSION_COUNT)
                .totalApprovedExtensionMinutes(extensionStats.totalApprovedMinutes())
                .maxExtensionMinutes(getMaxExtensionMinutes(ticket.getPriority()))
                .build();
    }
    

    private List<AppUser> getEligibleTechSupportsByAsset(Asset asset) {
        Integer techTypeId = getAssetTechTypeId(asset);
        List<AppUser> candidates = techTypeId <= 0
                ? appUserRepository.findByRole("TechSupport")
                : appUserRepository.findByRoleAndTechSupportTypeId("TechSupport", techTypeId);
        return candidates.stream()
                .filter(user -> "Hoạt động".equals(user.getStatus()))
                .toList();
    }

    private Integer getAssetTechTypeId(Asset asset) {
        if (asset.getCategory() == null || asset.getCategory().getTechSupportType() == null
                || asset.getCategory().getTechSupportType().getId() == null) {
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
                repairInProgress));
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
                false));
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
                homeLocationId);
    }

    private String resolveTechnicalStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.TECHNICAL_STATUS_GOOD;
        }
        return AssetStatusSupport.resolveTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
    }

    private boolean canAccessTicket(AppUser actor, Ticket ticket) {
        if (actor == null || ticket == null) {
            return false;
        }
        if ("Admin".equals(actor.getRole())) {
            return true;
        }
        if ("NhanVien".equals(actor.getRole())) {
            return ticket.getReporter() != null && actor.getId().equals(ticket.getReporter().getId());
        }
        if (!"TechSupport".equals(actor.getRole())) {
            return false;
        }
        boolean isAssignee = ticket.getAssignee() != null
                && actor.getId().equals(ticket.getAssignee().getId());
        if (isAssignee) {
            return true;
        }
        if (!TicketStatusSupport.PENDING.equals(ticket.getStatus())) {
            return false;
        }
        Integer ticketTechTypeId = getAssetTechTypeId(ticket.getAsset());
        return ticketTechTypeId > 0 && userHasTechSupportType(actor, ticketTechTypeId);
    }

    private String toVietnameseStatus(String status) {
        if ("PENDING".equals(status))
            return "Mới báo hỏng";
        if ("IN_PROGRESS".equals(status))
            return "Đang xử lý";
        if ("AWAITING_CONFIRMATION".equals(status))
            return "Chờ người báo xác nhận";
        if ("WAITING_REPLACEMENT".equals(status))
            return "Chờ thay thế thiết bị";
        if ("RESOLVED".equals(status))
            return "Đã hoàn tất";
        if ("CLOSED_UNRESOLVED".equals(status))
            return "Đóng - không thể sửa";
        if ("CANCELLED".equals(status))
            return "Đã hủy";
        if ("REJECTED".equals(status))
            return "Đã từ chối";
        return status;
    }

    private String toVietnameseResolutionOutcome(String outcome) {
        return switch (outcome) {
            case "REPAIRED" -> "Đã sửa xong";
            case "NO_FAULT_FOUND" -> "Không phát hiện lỗi";
            case "UNREPAIRABLE" -> "Không thể sửa chữa";
            case "REPLACEMENT_REQUIRED" -> "Cần thay thế";
            default -> outcome;
        };
    }

    private String toVietnamesePriority(String priority) {
        if ("HIGH".equals(priority))
            return "Cao";
        if ("LOW".equals(priority))
            return "Thấp";
        if ("MEDIUM".equals(priority))
            return "Trung bình";
        return priority;
    }

    private void pushNotification(String type, String message, Ticket ticket) {
        pushNotification(type, message, ticket, List.of());
    }

    private List<NotificationTarget> ticketNotificationTargets(Ticket ticket) {
        List<NotificationTarget> targets = new ArrayList<>();
        targets.add(NotificationTarget.forRole("Admin", "/admin/tickets/" + ticket.getId()));
        if (ticket.getReporter() != null && ticket.getReporter().getId() != null) {
            targets.add(NotificationTarget.forUser(
                    ticket.getReporter().getId(),
                    "/mobile/tickets/" + ticket.getId()));
        }
        if (ticket.getAssignee() != null && ticket.getAssignee().getId() != null) {
            targets.add(NotificationTarget.forUser(
                    ticket.getAssignee().getId(),
                    "/tech/tickets/" + ticket.getId()));
        }
        return targets;
    }

    private void pushNotification(String type, String message, Ticket ticket, List<AppUser> receivers) {
        RealtimeNotificationResponse payload = RealtimeNotificationResponse.builder()
                .type(type)
                .message(message)
                .ticketId(ticket.getId())
                .assetQaCode(ticket.getAsset().getQaCode())
                .status(ticket.getStatus())
                .timestamp(UtcDateTimes.now())
                .build();
        Map<Integer, AppUser> recipients = new LinkedHashMap<>();
        if (receivers != null) {
            for (AppUser receiver : receivers) {
                if (receiver != null && receiver.getId() != null) {
                    recipients.put(receiver.getId(), receiver);
                }
            }
        }
        if (ticket.getReporter() != null && ticket.getReporter().getId() != null) {
            recipients.put(ticket.getReporter().getId(), ticket.getReporter());
        }
        if (ticket.getAssignee() != null && ticket.getAssignee().getId() != null) {
            recipients.put(ticket.getAssignee().getId(), ticket.getAssignee());
        }
        for (AppUser admin : appUserRepository.findByRole("Admin")) {
            if (admin != null && admin.getId() != null) {
                recipients.put(admin.getId(), admin);
            }
        }
        for (Integer recipientId : recipients.keySet()) {
            asyncRealtimePushService.pushToDestination(
                    "/topic/users/" + recipientId + "/notifications",
                    payload);
        }
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

    @Transactional
    public TicketResponse requestExtension(Integer ticketId, TicketExtensionRequest request) {
        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));

        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"TechSupport".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ kỹ thuật viên mới được phép yêu cầu gia hạn.");
        }

        if (ticket.getAssignee() == null || !actor.getId().equals(ticket.getAssignee().getId())) {
            throw new AccessDeniedException("Bạn không được phân công xử lý ticket này.");
        }

        if (!TicketStatusSupport.isTechnicianWork(ticket.getStatus())) {
            throw new CustomException("Chỉ có thể yêu cầu gia hạn khi ticket đang xử lý hoặc chờ thay thế.");
        }

        TicketEvent latestExtensionEvent = findLatestExtensionEvent(ticketId);
        if (latestExtensionEvent != null && "EXTENSION_REQUESTED".equals(latestExtensionEvent.getEventType())) {
            throw new CustomException("Đã có một yêu cầu gia hạn đang chờ admin duyệt.");
        }
        ExtensionStats extensionStats = getExtensionStats(ticketId);
        int maxExtensionMinutes = getMaxExtensionMinutes(ticket.getPriority());
        if (extensionStats.approvedCount() >= MAX_EXTENSION_COUNT) {
            throw new CustomException("Ticket đã đạt số lần gia hạn tối đa.");
        }
        if (request.getRequestedMinutes() == null || request.getRequestedMinutes() <= 0
                || extensionStats.totalApprovedMinutes() + request.getRequestedMinutes() > maxExtensionMinutes) {
            throw new CustomException("Số phút gia hạn vượt quá giới hạn còn lại của ticket.");
        }

        // Record the event
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("requestedMinutes", request.getRequestedMinutes());
        detail.put("reason", request.getReason());
        detail.put("status", "PENDING");

        ticketEventService.recordEvent(
                ticket,
                "EXTENSION_REQUESTED",
                actor,
                "[Yêu cầu gia hạn] Xin thêm " + request.getRequestedMinutes() + " phút. Lý do: " + request.getReason(),
                detail);

        // Create notification for Admins
        String technicianName = StringUtils.hasText(actor.getFullName()) ? actor.getFullName() : actor.getUsername();
        notificationService.createNotification(
                "EXTENSION_REQUESTED",
                "Yêu cầu gia hạn xử lý ticket #" + ticketId,
                technicianName + " yêu cầu gia hạn thêm " + request.getRequestedMinutes() + " phút cho ticket #"
                        + ticketId + " với lý do: " + request.getReason(),
                actor.getUsername(),
                ticket.getAsset().getQaCode(),
                ticket.getAsset().getName(),
                Map.of(
                        "Ticket ID", "#" + ticketId,
                        "Kỹ thuật viên", technicianName,
                        "Số phút xin thêm", request.getRequestedMinutes(),
                        "Lý do", request.getReason()));

        return mapToResponse(ticket);
    }

    @Transactional
    public TicketResponse reviewExtension(Integer ticketId, TicketExtensionReviewRequest request) {
        Ticket ticket = ticketRepository.findDetailForUpdateById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));

        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin mới có quyền duyệt yêu cầu gia hạn.");
        }
        if (!TicketStatusSupport.isTechnicianWork(ticket.getStatus())) {
            throw new CustomException("Không thể duyệt gia hạn vì ticket không còn ở bước xử lý kỹ thuật.");
        }

        TicketEvent pendingRequestEvent = findLatestExtensionEvent(ticketId);
        if (pendingRequestEvent == null) {
            throw new CustomException("Không tìm thấy yêu cầu gia hạn nào đang chờ duyệt cho ticket này.");
        }
        if (!"EXTENSION_REQUESTED".equals(pendingRequestEvent.getEventType())) {
            throw new CustomException("Không còn yêu cầu gia hạn nào đang chờ duyệt cho ticket này.");
        }

        Integer requestedMinutes = parseRequestedMinutes(pendingRequestEvent);

        if (requestedMinutes <= 0) {
            throw new CustomException("Không thể xác định số phút yêu cầu gia hạn từ lịch sử sự kiện.");
        }
        ExtensionStats extensionStats = getExtensionStats(ticketId);
        if (extensionStats.approvedCount() >= MAX_EXTENSION_COUNT
                || extensionStats.totalApprovedMinutes() + requestedMinutes > getMaxExtensionMinutes(ticket.getPriority())) {
            throw new CustomException("Yêu cầu gia hạn vượt quá giới hạn của ticket.");
        }

        String decision = request.getDecision().trim().toUpperCase();
        String adminName = StringUtils.hasText(actor.getFullName()) ? actor.getFullName() : actor.getUsername();

        if ("APPROVED".equals(decision)) {
            if (ticket.getDueDate() != null && UtcDateTimes.now().isAfter(ticket.getDueDate())) {
                throw new CustomException("Không thể duyệt gia hạn sau khi ticket đã quá hạn SLA.");
            }
            LocalDateTime oldDueDate = ticket.getDueDate() != null ? ticket.getDueDate() : UtcDateTimes.now();
            LocalDateTime newDueDate = oldDueDate.plusMinutes(requestedMinutes);
            ticket.setDueDate(newDueDate);
            int currentMin = ticket.getSlaMinMinutes() != null
                    ? ticket.getSlaMinMinutes()
                    : defaultSlaRange(ticket.getPriority()).minMinutes();
            int currentMax = ticket.getSlaMaxMinutes() != null
                    ? ticket.getSlaMaxMinutes()
                    : defaultSlaRange(ticket.getPriority()).maxMinutes();
            ticket.setSlaMinMinutes(currentMin + requestedMinutes);
            ticket.setSlaMaxMinutes(currentMax + requestedMinutes);

            ticketRepository.save(ticket);
            helpdeskKpiService.invalidateCaches();

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("decision", "APPROVED");
            detail.put("requestedMinutes", requestedMinutes);
            detail.put("newDueDate", newDueDate.toString());

            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                    .ofPattern("dd/MM/yyyy HH:mm");
            ticketEventService.recordEvent(
                    ticket,
                    "EXTENSION_APPROVED",
                    actor,
                    "[Gia hạn được duyệt] Admin " + adminName + " đã duyệt yêu cầu gia hạn thêm " + requestedMinutes
                            + " phút. Hạn xử lý mới: " + newDueDate.format(formatter),
                    detail);

            if (ticket.getAssignee() != null) {
                notificationService.createNotification(
                        "EXTENSION_APPROVED",
                        "Yêu cầu gia hạn ticket #" + ticketId + " được duyệt",
                        "Yêu cầu gia hạn thêm " + requestedMinutes + " phút của bạn cho ticket #" + ticketId
                                + " đã được phê duyệt bởi Admin " + adminName + ". Hạn xử lý mới: "
                                + newDueDate.format(formatter),
                        actor.getUsername(),
                        ticket.getAsset().getQaCode(),
                        ticket.getAsset().getName(),
                        Map.of(
                                "Ticket ID", "#" + ticketId,
                                "Quyết định", "Phê duyệt",
                                "Số phút gia hạn", requestedMinutes,
                                "Hạn mới", newDueDate.format(formatter)),
                        ticketNotificationTargets(ticket));
            }
        } else {
            String rejectReason = StringUtils.hasText(request.getRejectReason()) ? request.getRejectReason().trim()
                    : "Không có lý do cụ thể.";

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("decision", "REJECTED");
            detail.put("rejectReason", rejectReason);

            ticketEventService.recordEvent(
                    ticket,
                    "EXTENSION_REJECTED",
                    actor,
                    "[Gia hạn bị từ chối] Admin " + adminName + " đã từ chối yêu cầu gia hạn. Lý do: " + rejectReason,
                    detail);

            if (ticket.getAssignee() != null) {
                notificationService.createNotification(
                        "EXTENSION_REJECTED",
                        "Yêu cầu gia hạn ticket #" + ticketId + " bị từ chối",
                        "Yêu cầu gia hạn thêm " + requestedMinutes + " phút của bạn cho ticket #" + ticketId
                                + " đã bị từ chối bởi Admin " + adminName + ". Lý do: " + rejectReason,
                        actor.getUsername(),
                        ticket.getAsset().getQaCode(),
                        ticket.getAsset().getName(),
                        Map.of(
                                "Ticket ID", "#" + ticketId,
                                "Quyết định", "Từ chối",
                                "Lý do", rejectReason),
                        ticketNotificationTargets(ticket));
            }
        }

        return mapToResponse(ticket);
    }

    @Transactional(readOnly = true)
    public List<TicketExtensionEventResponse> getExtensionRequests() {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin mới có quyền xem danh sách yêu cầu gia hạn.");
        }

        List<TicketEvent> reqEvents = ticketEventRepository.findByEventTypeOrderByOccurredAtDesc("EXTENSION_REQUESTED");
        List<TicketExtensionEventResponse> responses = new java.util.ArrayList<>();

        for (TicketEvent reqEvent : reqEvents) {
            Ticket ticket = reqEvent.getTicket();

            TicketEvent reviewEvent = findFirstReviewAfterRequest(ticket.getId(), reqEvent.getOccurredAt());

            String status = "PENDING";
            String rejectReason = null;
            LocalDateTime reviewedAt = null;

            if (reviewEvent != null) {
                if ("EXTENSION_APPROVED".equals(reviewEvent.getEventType())) {
                    status = "APPROVED";
                } else if ("EXTENSION_EXPIRED".equals(reviewEvent.getEventType())) {
                    status = "EXPIRED";
                } else {
                    status = "REJECTED";
                    rejectReason = parseRejectReason(reviewEvent);
                }
                reviewedAt = reviewEvent.getOccurredAt();
            } else if (!TicketStatusSupport.isTechnicianWork(ticket.getStatus())) {
                status = "EXPIRED";
            }

            int requestedMinutes = 0;
            String reason = "";

            try {
                String detailText = reqEvent.getDetailJson();
                if (StringUtils.hasText(detailText)) {
                    String[] lines = detailText.split("\n");
                    for (String line : lines) {
                        if (line.startsWith("requestedMinutes: ")) {
                            requestedMinutes = Integer.parseInt(line.substring(18).trim());
                        } else if (line.startsWith("reason: ")) {
                            reason = line.substring(8).trim();
                        }
                    }
                }
            } catch (Exception e) {
                // ignore
            }

            if (requestedMinutes <= 0) {
                try {
                    String msg = reqEvent.getMessage();
                    int idx = msg.indexOf("Xin thêm ");
                    if (idx != -1) {
                        int endIdx = msg.indexOf(" phút", idx);
                        if (endIdx > idx) {
                            requestedMinutes = Integer.parseInt(msg.substring(idx + 9, endIdx).trim());
                        }
                    }
                } catch (Exception ex) {
                    // ignore
                }
            }

            if (requestedMinutes <= 0) {
                requestedMinutes = 15;
            }

            responses.add(TicketExtensionEventResponse.builder()
                    .id(reqEvent.getId())
                    .ticketId(ticket.getId())
                    .ticketStatus(ticket.getStatus())
                    .priority(ticket.getPriority())
                    .assetName(ticket.getAsset().getName())
                    .assetQaCode(ticket.getAsset().getQaCode())
                    .assigneeName(
                            ticket.getAssignee() != null
                                    ? (StringUtils.hasText(ticket.getAssignee().getFullName())
                                            ? ticket.getAssignee().getFullName()
                                            : ticket.getAssignee().getUsername())
                                    : "Chưa phân công")
                    .requesterName(reqEvent.getActorName())
                    .requestedMinutes(requestedMinutes)
                    .reason(StringUtils.hasText(reason) ? reason : reqEvent.getMessage())
                    .status(status)
                    .rejectReason(rejectReason)
                    .requestedAt(reqEvent.getOccurredAt())
                    .reviewedAt(reviewedAt)
                    .build());
        }

        return responses;
    }

    public List<SuggestedTechnicianResponse> getSuggestedTechnicians(Integer ticketId) {
        if (ticketId == null) {
            throw new CustomException("id ticket là bắt buộc.");
        }
        Ticket ticket = ticketRepository.findDetailById(ticketId)
                .orElseThrow(() -> new CustomException("Không tìm thấy ticket."));

        Asset asset = ticket.getAsset();
        if (asset == null) {
            throw new CustomException("Ticket không có thông tin thiết bị.");
        }

        List<AppUser> eligibleTechs = getEligibleTechSupportsByAsset(asset);
        Integer categoryId = asset.getCategory() != null ? asset.getCategory().getId() : null;

        List<SuggestedTechnicianResponse> results = new java.util.ArrayList<>();
        long minActiveCount = Long.MAX_VALUE;
        long maxResolvedCount = -1;

        List<TechScoreTemp> temp = new java.util.ArrayList<>();

        for (AppUser tech : eligibleTechs) {
            long activeCount = ticketRepository.countByAssigneeIdAndStatus(tech.getId(), "IN_PROGRESS")
                    + ticketRepository.countByAssigneeIdAndStatus(tech.getId(), "WAITING_REPLACEMENT");

            long resolvedCount = 0;
            if (categoryId != null) {
                resolvedCount = ticketRepository.countByAssigneeIdAndStatusAndAssetCategoryId(tech.getId(), "RESOLVED", categoryId);
            }

            if (activeCount < minActiveCount) {
                minActiveCount = activeCount;
            }
            if (resolvedCount > maxResolvedCount) {
                maxResolvedCount = resolvedCount;
            }

            temp.add(new TechScoreTemp(tech, activeCount, resolvedCount));
        }

        for (TechScoreTemp t : temp) {
            boolean isLeastBusy = (t.activeCount == minActiveCount);
            boolean isMostExperienced = (maxResolvedCount > 0 && t.resolvedCount == maxResolvedCount);

            String reason;
            if (isLeastBusy && isMostExperienced) {
                reason = "Chuyên môn tốt & Đang rảnh";
            } else if (isLeastBusy) {
                reason = "Cân bằng tải tốt (Đang rảnh)";
            } else if (isMostExperienced) {
                reason = "Kinh nghiệm sửa loại thiết bị này tốt";
            } else {
                reason = "Đúng chuyên môn";
            }

            results.add(SuggestedTechnicianResponse.builder()
                    .id(t.user.getId())
                    .username(t.user.getUsername())
                    .fullName(t.user.getFullName())
                    .activeCount(t.activeCount)
                    .resolvedCount(t.resolvedCount)
                    .recommendationReason(reason)
                    .build());
        }

        results.sort((a, b) -> {
            long scoreA = (a.getResolvedCount() * 2) - (a.getActiveCount() * 3);
            long scoreB = (b.getResolvedCount() * 2) - (b.getActiveCount() * 3);
            if (scoreA != scoreB) {
                return Long.compare(scoreB, scoreA);
            }
            String nameA = a.getFullName() != null ? a.getFullName() : a.getUsername();
            String nameB = b.getFullName() != null ? b.getFullName() : b.getUsername();
            return nameA.compareToIgnoreCase(nameB);
        });

        return results;
    }

    private static class TechScoreTemp {
        AppUser user;
        long activeCount;
        long resolvedCount;

        TechScoreTemp(AppUser user, long activeCount, long resolvedCount) {
            this.user = user;
            this.activeCount = activeCount;
            this.resolvedCount = resolvedCount;
        }
    }

    private String parseRejectReason(TicketEvent reviewEvent) {
        try {
            String detailText = reviewEvent.getDetailJson();
            if (StringUtils.hasText(detailText)) {
                String[] lines = detailText.split("\n");
                for (String line : lines) {
                    if (line.startsWith("rejectReason: ")) {
                        return line.substring(14).trim();
                    }
                }
            }
        } catch (Exception e) {
            // ignore
        }
        String msg = reviewEvent.getMessage();
        if (msg != null && msg.contains("Lý do: ")) {
            return msg.substring(msg.indexOf("Lý do: ") + 7).trim();
        }
        return "Không có lý do cụ thể.";
    }

    private TicketEvent findLatestExtensionEvent(Integer ticketId) {
        return ticketEventRepository.findFirstByTicketIdAndEventTypeInOrderByOccurredAtDescIdDesc(
                ticketId,
                EXTENSION_FLOW_EVENT_TYPES
        ).orElse(null);
    }

    private TicketEvent findFirstReviewAfterRequest(Integer ticketId, LocalDateTime requestedAt) {
        if (ticketId == null || requestedAt == null) {
            return null;
        }
        return ticketEventRepository.findFirstByTicketIdAndEventTypeInAndOccurredAtAfterOrderByOccurredAtAscIdAsc(
                ticketId,
                EXTENSION_REVIEW_EVENT_TYPES,
                requestedAt
        ).orElse(null);
    }

    private record TicketFilter(String status, Integer assigneeId, String assetQaCode, Integer reporterId) {
    }

    private record SlaRange(int minMinutes, int maxMinutes) {
    }

    private record ExtensionStats(int approvedCount, int totalApprovedMinutes) {
    }
}
