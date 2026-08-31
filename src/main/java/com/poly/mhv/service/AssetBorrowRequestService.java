package com.poly.mhv.service;

import com.poly.mhv.dto.inquiry.AssetBorrowRequestResponse;
import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.dto.usage.CheckoutRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AssetBorrowRequestService {

    private static final ZoneOffset STORAGE_OFFSET = ZoneOffset.UTC;
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VIETNAM_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<String> SCHEDULE_BLOCKING_STATUSES =
            List.of("PENDING", "APPROVED", "RESERVED", "CHECKED_OUT");

    private final AssetBorrowRequestRepository repository;
    private final AssetRepository assetRepository;
    private final ServiceInquiryRepository inquiryRepository;
    private final CurrentUserProvider currentUserProvider;
    private final UsageHistoryService usageHistoryService;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;

    @Transactional(readOnly = true)
    public List<AssetBorrowRequestResponse> getMine() {
        AppUser actor = currentUserProvider.getCurrentUser();
        return repository.findByRequesterIdOrderByCreatedAtDesc(actor.getId()).stream()
                .map(this::mapResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssetBorrowRequestResponse> getInbox(String status) {
        requireAdmin();
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .filter(request -> !StringUtils.hasText(status) || request.getStatus().equalsIgnoreCase(status.trim()))
                .map(this::mapResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetBorrowRequestResponse getById(Long id) {
        AssetBorrowRequest request = getDetail(id);
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole()) && !actor.getId().equals(request.getRequester().getId())) {
            throw new AccessDeniedException("Bạn không có quyền xem phiếu mượn này.");
        }
        return mapResponse(request);
    }

    @Transactional
    public AssetBorrowRequestResponse approve(Long id, BorrowRequestDecisionRequest decision) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        requireStatus(request, "PENDING");
        assetRepository.findByQaCodeForUpdate(request.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị cần duyệt."));
        if (repository.existsOverlappingSchedule(
                request.getAsset().getQaCode(),
                request.getNeededFrom(),
                request.getExpectedReturnDate(),
                SCHEDULE_BLOCKING_STATUSES,
                request.getId())) {
            throw new CustomException("Thiết bị đã có lịch mượn trùng với khoảng ngày được yêu cầu.");
        }
        LocalDateTime now = UtcDateTimes.now();
        request.setStatus("APPROVED");
        request.setApprovedBy(admin);
        request.setApprovedAt(now);
        request.setDecisionNote(note(decision));
        AssetBorrowRequest saved = repository.save(request);
        notifyRequester(saved, "BORROW_REQUEST_APPROVED", "Phiếu mượn đã được duyệt",
                "Phiếu mượn #" + saved.getId() + " đã được " + displayName(admin) + " phê duyệt.");
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse reserve(Long id, BorrowRequestDecisionRequest decision) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        requireStatus(request, "APPROVED");
        LocalDateTime now = UtcDateTimes.now();
        LocalDateTime reservationOpensAt = request.getNeededFrom().minusDays(1).atStartOfDay(BUSINESS_ZONE)
                .withZoneSameInstant(STORAGE_OFFSET)
                .toLocalDateTime();
        if (now.isBefore(reservationOpensAt)) {
            throw new CustomException("Chỉ có thể giữ chỗ trong vòng 24 giờ trước ngày cần "
                    + formatDate(request.getNeededFrom()) + ".");
        }
        LocalDateTime neededDateExpiry = request.getNeededFrom().plusDays(1).atStartOfDay(BUSINESS_ZONE)
                .withZoneSameInstant(STORAGE_OFFSET)
                .toLocalDateTime();
        request.setStatus("RESERVED");
        request.setReservedAt(now);
        request.setReservationExpiresAt(neededDateExpiry);
        if (StringUtils.hasText(note(decision))) {
            request.setDecisionNote(note(decision));
        }
        AssetBorrowRequest saved = repository.save(request);
        notifyRequester(saved, "BORROW_REQUEST_RESERVED", "Thiết bị đã được giữ chỗ",
                displayName(admin) + " đã giữ thiết bị " + saved.getAsset().getQaCode()
                        + " cho bạn đến hết ngày cần " + formatDate(saved.getNeededFrom()) + ".");
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse reject(Long id, BorrowRequestDecisionRequest decision) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        if (!List.of("PENDING", "APPROVED", "RESERVED").contains(request.getStatus())) {
            throw new CustomException("Phiếu mượn không còn ở trạng thái có thể từ chối.");
        }
        String reason = note(decision);
        if (!StringUtils.hasText(reason)) {
            throw new CustomException("Vui lòng nhập lý do từ chối phiếu mượn.");
        }
        request.setStatus("REJECTED");
        request.setApprovedBy(admin);
        request.setDecisionNote(reason);
        AssetBorrowRequest saved = repository.save(request);
        updateInquiry(saved, InquiryStatusSupport.REJECTED, reason, true);
        notifyRequester(saved, "BORROW_REQUEST_REJECTED", "Phiếu mượn đã bị từ chối", reason);
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse handover(Long id) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        if (!List.of("APPROVED", "RESERVED").contains(request.getStatus())) {
            throw new CustomException("Phiếu mượn chưa được duyệt hoặc đã được bàn giao.");
        }
        LocalDateTime now = UtcDateTimes.now();
        LocalDateTime handoverOpensAt = request.getNeededFrom().atStartOfDay(BUSINESS_ZONE)
                .withZoneSameInstant(STORAGE_OFFSET)
                .toLocalDateTime();
        if (now.isBefore(handoverOpensAt)) {
            throw new CustomException("Chỉ có thể bàn giao thiết bị từ ngày cần "
                    + formatDate(request.getNeededFrom()) + ".");
        }
        if ("RESERVED".equals(request.getStatus()) && request.getReservationExpiresAt() != null
                && request.getReservationExpiresAt().isBefore(now)) {
            request.setStatus("EXPIRED");
            repository.save(request);
            updateInquiry(request, InquiryStatusSupport.REJECTED, "Thời gian giữ chỗ đã hết.", true);
            throw new CustomException("Thời gian giữ chỗ đã hết. Vui lòng tạo hoặc duyệt lại phiếu mượn.");
        }
        usageHistoryService.checkout(CheckoutRequest.builder()
                .assetQaCode(request.getAsset().getQaCode())
                .userId(request.getRequester().getId())
                .toLocationId(request.getDestinationLocation().getId())
                .build());
        request.setStatus("CHECKED_OUT");
        request.setCheckedOutAt(now);
        request.setApprovedBy(admin);
        AssetBorrowRequest saved = repository.save(request);
        updateInquiry(saved, InquiryStatusSupport.WAITING_EMPLOYEE,
                "Đã bàn giao thiết bị, chờ nhân viên xác nhận đã nhận.", false);
        notifyRequester(saved, "BORROW_REQUEST_HANDED_OVER", "Đã bàn giao thiết bị",
                "Thiết bị " + saved.getAsset().getQaCode() + " đã được bàn giao cho bạn.");
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse confirmReturn(Long id) {
        AssetBorrowRequest request = getForUpdate(id);
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole()) && !actor.getId().equals(request.getRequester().getId())) {
            throw new AccessDeniedException("Bạn không có quyền xác nhận trả thiết bị này.");
        }
        requireStatus(request, "CHECKED_OUT");
        if ("Admin".equals(actor.getRole())) {
            usageHistoryService.checkinForAdmin(request.getAsset().getQaCode());
        } else {
            usageHistoryService.checkin(com.poly.mhv.dto.usage.CheckinRequest.builder()
                    .assetQaCode(request.getAsset().getQaCode())
                    .build());
        }
        request.setStatus("RETURNED");
        request.setReturnedAt(UtcDateTimes.now());
        AssetBorrowRequest saved = repository.save(request);
        notifyRequester(saved, "BORROW_REQUEST_RETURNED", "Đã hoàn tất trả thiết bị",
                "Thiết bị " + saved.getAsset().getQaCode() + " đã được ghi nhận trả về.");
        broadcast(saved);
        return mapResponse(saved);
    }

    private AppUser requireAdmin() {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin mới được xử lý phiếu mượn thiết bị.");
        }
        return actor;
    }

    private AssetBorrowRequest getDetail(Long id) {
        return repository.findDetailById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu mượn thiết bị."));
    }

    private AssetBorrowRequest getForUpdate(Long id) {
        return repository.findForUpdateById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu mượn thiết bị."));
    }

    private void requireStatus(AssetBorrowRequest request, String expected) {
        if (!expected.equals(request.getStatus())) {
            throw new CustomException("Phiếu mượn không ở trạng thái " + expected + ".");
        }
    }

    private void updateInquiry(
            AssetBorrowRequest borrowRequest,
            String status,
            String note,
            boolean completed) {
        ServiceInquiry inquiry = borrowRequest.getInquiry();
        if (inquiry == null) {
            return;
        }
        inquiry.setStatus(status);
        inquiry.setDecisionNote(note);
        inquiry.setUpdatedAt(UtcDateTimes.now());
        if (completed) {
            inquiry.setCompletedAt(UtcDateTimes.now());
        }
        inquiryRepository.save(inquiry);
    }

    private void notifyRequester(AssetBorrowRequest request, String eventType, String title, String message) {
        String path = request.getInquiry() != null
                ? "/mobile/inquiries/" + request.getInquiry().getId()
                : "/mobile/home";
        notificationService.createNotification(
                eventType,
                title,
                message,
                request.getApprovedBy() != null ? request.getApprovedBy().getUsername() : "system",
                request.getAsset().getQaCode(),
                request.getAsset().getName(),
                Map.of("Phiếu mượn", "#" + request.getId(), "Trạng thái", request.getStatus()),
                List.of(NotificationTarget.forUser(request.getRequester().getId(), path)));
    }

    private void broadcast(AssetBorrowRequest request) {
        AssetBorrowRequestResponse payload = mapResponse(request);
        realtimePushService.pushToDestination(
                "/topic/users/" + request.getRequester().getId() + "/borrow-requests",
                payload);
        if (request.getInquiry() != null && request.getInquiry().getAssignee() != null) {
            realtimePushService.pushToDestination(
                    "/topic/users/" + request.getInquiry().getAssignee().getId() + "/borrow-requests",
                    payload);
        }
    }

    private AssetBorrowRequestResponse mapResponse(AssetBorrowRequest request) {
        return AssetBorrowRequestResponse.builder()
                .id(request.getId())
                .inquiryId(request.getInquiry() != null ? request.getInquiry().getId() : null)
                .assetQaCode(request.getAsset().getQaCode())
                .assetName(request.getAsset().getName())
                .requesterId(request.getRequester().getId())
                .requesterName(displayName(request.getRequester()))
                .approvedByUserId(request.getApprovedBy() != null ? request.getApprovedBy().getId() : null)
                .approvedByName(request.getApprovedBy() != null ? displayName(request.getApprovedBy()) : null)
                .destinationLocationId(request.getDestinationLocation().getId())
                .destinationLocationName(request.getDestinationLocation().getRoomName())
                .neededFrom(request.getNeededFrom())
                .expectedReturnDate(request.getExpectedReturnDate())
                .purpose(request.getPurpose())
                .status(request.getStatus())
                .decisionNote(request.getDecisionNote())
                .createdAt(toOffset(request.getCreatedAt()))
                .approvedAt(toOffset(request.getApprovedAt()))
                .reservedAt(toOffset(request.getReservedAt()))
                .reservationExpiresAt(toOffset(request.getReservationExpiresAt()))
                .checkedOutAt(toOffset(request.getCheckedOutAt()))
                .returnedAt(toOffset(request.getReturnedAt()))
                .build();
    }

    private String displayName(AppUser user) {
        return user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private String note(BorrowRequestDecisionRequest request) {
        return request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(STORAGE_OFFSET);
    }

    private String formatDate(java.time.LocalDate value) {
        return value == null ? "-" : value.format(VIETNAM_DATE_FORMAT);
    }
}
