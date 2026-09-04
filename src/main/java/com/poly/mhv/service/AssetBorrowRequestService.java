package com.poly.mhv.service;

import com.poly.mhv.dto.inquiry.AssetBorrowRequestCreateRequest;
import com.poly.mhv.dto.inquiry.AssetBorrowRequestResponse;
import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.dto.usage.CheckinRequest;
import com.poly.mhv.dto.usage.CheckoutRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.AssetStatusSupport;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Slf4j
@RequiredArgsConstructor
public class AssetBorrowRequestService {

    private static final ZoneOffset STORAGE_OFFSET = ZoneOffset.UTC;
    private static final Set<String> ACTIVE_REQUEST_STATUSES = Set.of("PENDING", "RESERVED", "CHECKED_OUT", "RETURN_PENDING");
    private static final Set<String> OVERLAP_BLOCKING_STATUSES = Set.of("RESERVED", "CHECKED_OUT", "RETURN_PENDING");

    private final AssetBorrowRequestRepository repository;
    private final AssetRepository assetRepository;
    private final LocationRepository locationRepository;
    private final ServiceInquiryRepository inquiryRepository;
    private final CurrentUserProvider currentUserProvider;
    private final UsageHistoryService usageHistoryService;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;

    @Transactional
    public AssetBorrowRequestResponse create(AssetBorrowRequestCreateRequest request) {
        AppUser requester = currentUserProvider.getCurrentUser();
        if (!"NhanVien".equals(requester.getRole())) {
            throw new AccessDeniedException("Chỉ nhân viên mới được tạo phiếu mượn thiết bị.");
        }
        if (request == null) {
            throw new CustomException("Dữ liệu phiếu mượn không được để trống.");
        }

        Asset asset = assetRepository.findDetailByQaCode(normalizeAssetQaCode(request.getAssetQaCode()))
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị đã chọn."));
        validateAssetForBorrowRequest(asset);

        Location destination = locationRepository.findById(request.getDestinationLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng sử dụng."));

        if (asset.getLocation() != null && asset.getLocation().getId().equals(destination.getId())) {
            throw new CustomException("Phòng sử dụng không được trùng với vị trí hiện tại của thiết bị.");
        }

        LocalDateTime startAt = request.getStartAt();
        LocalDateTime endAt = request.getEndAt();
        if (startAt == null || endAt == null) {
            throw new CustomException("Thời gian mượn và trả là bắt buộc.");
        }
        if (!endAt.isAfter(startAt)) {
            throw new CustomException("Thời điểm hẹn trả phải sau thời điểm bắt đầu mượn.");
        }
        if (repository.existsByAssetQaCodeAndRequesterIdAndStatusIn(
                asset.getQaCode(),
                requester.getId(),
                ACTIVE_REQUEST_STATUSES)) {
            throw new CustomException("Bạn đang có phiếu mượn đang chờ duyệt hoặc chưa trả cho thiết bị này.");
        }
        if (repository.existsOverlappingReservation(
                asset.getQaCode(),
                OVERLAP_BLOCKING_STATUSES,
                startAt,
                endAt)) {
            throw new CustomException("Thiết bị đã có lịch mượn trùng khoảng thời gian này.");
        }

        LocalDateTime now = UtcDateTimes.now();
        AssetBorrowRequest borrowRequest = AssetBorrowRequest.builder()
                .asset(asset)
                .requester(requester)
                .destinationLocation(destination)
                .startAt(startAt)
                .endAt(endAt)
                .neededFrom(startAt.toLocalDate())
                .expectedReturnDate(endAt.toLocalDate())
                .purpose(request.getPurpose().trim())
                .status("PENDING")
                .createdAt(now)
                .build();
        AssetBorrowRequest saved = repository.save(borrowRequest);

        notificationService.createNotification(
                "BORROW_REQUEST_CREATED",
                "Có phiếu mượn thiết bị mới",
                displayName(requester) + " vừa gửi phiếu mượn cho thiết bị " + saved.getAsset().getQaCode() + ".",
                requester.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Phiếu mượn", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Phòng sử dụng", saved.getDestinationLocation().getRoomName(),
                        "Bắt đầu mượn", saved.getStartAt(),
                        "Hẹn trả", saved.getEndAt(),
                        "Người yêu cầu", displayName(requester)
                ),
                List.of(NotificationTarget.forRole("Admin", "/admin/borrow-requests"))
        );
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public List<AssetBorrowRequestResponse> getMine() {
        expirePendingRequestsPastEndTime();
        reconcileDueReservations();
        AppUser actor = currentUserProvider.getCurrentUser();
        return repository.findByRequesterIdOrderByCreatedAtDesc(actor.getId()).stream()
                .map(this::mapResponse)
                .toList();
    }

    @Transactional
    public List<AssetBorrowRequestResponse> getInbox(String status) {
        requireAdmin();
        expirePendingRequestsPastEndTime();
        reconcileDueReservations();
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .filter(request -> !StringUtils.hasText(status) || request.getStatus().equalsIgnoreCase(status.trim()))
                .map(this::mapResponse)
                .toList();
    }

    @Transactional
    public AssetBorrowRequestResponse getById(Long id) {
        expirePendingRequestsPastEndTime();
        reconcileDueReservations();
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
        LocalDateTime now = UtcDateTimes.now();
        if (!request.getEndAt().isAfter(now)) {
            return mapResponse(expirePendingRequest(request, "Phiếu mượn đã quá giờ trả nên không thể duyệt."));
        }
        request.setStatus("RESERVED");
        request.setApprovedBy(admin);
        request.setApprovedAt(now);
        request.setReservedAt(now);
        request.setDecisionNote(note(decision));
        AssetBorrowRequest saved = repository.save(request);

        if (!now.isBefore(saved.getStartAt())) {
            return checkoutReserved(saved.getId());
        }

        notifyRequester(
                saved,
                "BORROW_REQUEST_APPROVED",
                "Phiếu mượn đã được duyệt",
                "Phiếu mượn #" + saved.getId() + " đã được " + displayName(admin)
                        + " duyệt. Hệ thống sẽ tự bắt đầu lượt mượn khi tới thời gian đã đặt."
        );
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse checkoutReserved(Long id) {
        AssetBorrowRequest request = getForUpdate(id);
        requireStatus(request, "RESERVED");
        if (request.getStartAt() != null && request.getStartAt().isAfter(UtcDateTimes.now())) {
            throw new CustomException("Chưa đến thời điểm bắt đầu mượn để ghi nhận xuất tài sản.");
        }

        usageHistoryService.checkoutForSystem(CheckoutRequest.builder()
                .assetQaCode(request.getAsset().getQaCode())
                .userId(request.getRequester().getId())
                .toLocationId(request.getDestinationLocation().getId())
                .build());

        LocalDateTime now = UtcDateTimes.now();
        request.setStatus("CHECKED_OUT");
        if (request.getApprovedAt() == null) {
            request.setApprovedAt(now);
        }
        request.setCheckedOutAt(now);
        request.setLastOverdueReminderAt(null);
        AssetBorrowRequest saved = repository.save(request);

        updateInquiry(saved, InquiryStatusSupport.WAITING_EMPLOYEE,
                "Phiếu mượn đã bắt đầu.", false);
        notifyRequester(
                saved,
                "BORROW_REQUEST_CHECKED_OUT",
                "Phiếu mượn đã bắt đầu",
                "Phiếu mượn #" + saved.getId() + " đã tới thời điểm bắt đầu và đang được ghi nhận là đang mượn."
        );
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse requestReturn(CheckinRequest request) {
        AppUser requester = currentUserProvider.getCurrentUser();
        if (!"NhanVien".equals(requester.getRole())) {
            throw new AccessDeniedException("Chỉ nhân viên mới được gửi yêu cầu trả thiết bị.");
        }
        if (request == null || !StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("Mã QA thiết bị là bắt buộc.");
        }

        AssetBorrowRequest borrowRequest = repository.findFirstByAssetQaCodeAndRequesterIdAndStatusOrderByCreatedAtDesc(
                        request.getAssetQaCode().trim(),
                        requester.getId(),
                        "CHECKED_OUT")
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu mượn đang mở để gửi yêu cầu trả."));

        borrowRequest.setStatus("RETURN_PENDING");
        borrowRequest.setDecisionNote("Nhân viên đã quét mã QR để gửi yêu cầu trả thiết bị.");
        AssetBorrowRequest saved = repository.save(borrowRequest);

        notificationService.createNotification(
                "BORROW_RETURN_REQUESTED",
                "Có yêu cầu xác nhận trả thiết bị",
                displayName(requester) + " vừa gửi yêu cầu trả thiết bị " + saved.getAsset().getQaCode() + ".",
                requester.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Phiếu mượn", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Người trả", displayName(requester),
                        "Phòng đang mượn", saved.getDestinationLocation().getRoomName()
                ),
                List.of(NotificationTarget.forRole("Admin", "/admin/borrow-requests"))
        );
        notifyRequester(
                saved,
                "BORROW_RETURN_REQUESTED",
                "Đã gửi yêu cầu trả thiết bị",
                "Yêu cầu trả thiết bị " + saved.getAsset().getQaCode() + " đã được gửi tới Admin để xác nhận."
        );
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse confirmReturn(Long id, BorrowRequestDecisionRequest decision) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        requireStatus(request, "RETURN_PENDING");

        usageHistoryService.checkinForAdmin(request.getAsset().getQaCode());

        AssetBorrowRequest refreshed = getDetail(id);
        refreshed.setApprovedBy(admin);
        if (StringUtils.hasText(note(decision))) {
            refreshed.setDecisionNote(note(decision));
        }
        AssetBorrowRequest saved = repository.save(refreshed);

        notifyRequester(
                saved,
                "BORROW_RETURN_CONFIRMED",
                "Admin đã xác nhận trả thiết bị",
                "Thiết bị " + saved.getAsset().getQaCode() + " đã được Admin xác nhận trả và chuyển về vị trí gốc."
        );
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse reject(Long id, BorrowRequestDecisionRequest decision) {
        AppUser admin = requireAdmin();
        AssetBorrowRequest request = getForUpdate(id);
        if (!List.of("PENDING").contains(request.getStatus())) {
            throw new CustomException("Phiếu mượn không còn ở trạng thái có thể từ chối.");
        }
        if (!request.getEndAt().isAfter(UtcDateTimes.now())) {
            return mapResponse(expirePendingRequest(request, "Phiếu mượn đã quá giờ trả nên được khóa tự động."));
        }
        String reason = note(decision);
        if (!StringUtils.hasText(reason)) {
            throw new CustomException("Vui lòng nhập lý do từ chối phiếu mượn.");
        }
        request.setStatus("REJECTED");
        request.setApprovedBy(admin);
        request.setApprovedAt(UtcDateTimes.now());
        request.setDecisionNote(reason);
        AssetBorrowRequest saved = repository.save(request);

        updateInquiry(saved, InquiryStatusSupport.REJECTED, reason, true);
        notifyRequester(saved, "BORROW_REQUEST_REJECTED", "Phiếu mượn đã bị từ chối", reason);
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public AssetBorrowRequestResponse cancelMine(Long id, BorrowRequestDecisionRequest decision) {
        AppUser requester = currentUserProvider.getCurrentUser();
        if (!"NhanVien".equals(requester.getRole())) {
            throw new AccessDeniedException("Chỉ nhân viên mới được hủy phiếu mượn của mình.");
        }
        AssetBorrowRequest request = getForUpdate(id);
        if (!requester.getId().equals(request.getRequester().getId())) {
            throw new AccessDeniedException("Bạn không có quyền hủy phiếu mượn này.");
        }
        if (!List.of("PENDING", "RESERVED").contains(request.getStatus())) {
            throw new CustomException("Chỉ có thể hủy phiếu đang chờ duyệt hoặc đang giữ chỗ.");
        }
        request.setStatus("CANCELLED");
        String cancelNote = StringUtils.hasText(note(decision))
                ? note(decision)
                : "Nhân viên đã hủy phiếu mượn.";
        request.setDecisionNote(cancelNote);
        request.setLastOverdueReminderAt(null);
        AssetBorrowRequest saved = repository.save(request);

        updateInquiry(saved, InquiryStatusSupport.CANCELLED, cancelNote, true);
        notificationService.createNotification(
                "BORROW_REQUEST_CANCELLED",
                "Phiếu mượn đã được nhân viên hủy",
                displayName(requester) + " đã hủy phiếu mượn #" + saved.getId()
                        + " cho thiết bị " + saved.getAsset().getQaCode() + ".",
                requester.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Phiếu mượn", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Người hủy", displayName(requester),
                        "Bắt đầu mượn", saved.getStartAt(),
                        "Hẹn trả", saved.getEndAt()
                ),
                List.of(NotificationTarget.forRole("Admin", "/admin/borrow-requests"))
        );
        notifyRequester(saved, "BORROW_REQUEST_CANCELLED", "Đã hủy phiếu mượn", cancelNote);
        broadcast(saved);
        return mapResponse(saved);
    }

    @Transactional
    public void markReturnedByUsage(String assetQaCode, Integer requesterUserId) {
        if (!StringUtils.hasText(assetQaCode) || requesterUserId == null) {
            return;
        }
        repository.findFirstByAssetQaCodeAndRequesterIdAndStatusInOrderByCreatedAtDesc(
                        assetQaCode.trim(),
                        requesterUserId,
                        List.of("CHECKED_OUT", "RETURN_PENDING"))
                .ifPresent(request -> {
                    request.setStatus("RETURNED");
                    request.setReturnedAt(UtcDateTimes.now());
                    request.setLastOverdueReminderAt(null);
                    AssetBorrowRequest saved = repository.save(request);
                    notifyRequester(saved, "BORROW_REQUEST_RETURNED", "Đã hoàn tất trả thiết bị",
                            "Thiết bị " + saved.getAsset().getQaCode() + " đã được ghi nhận trả về.");
                    broadcast(saved);
                });
    }

    @Transactional
    public void expirePendingRequestsPastEndTime() {
        LocalDateTime now = UtcDateTimes.now();
        List<AssetBorrowRequest> expiredRequests = repository.findPendingExpiredByEndAt(now);
        for (AssetBorrowRequest request : expiredRequests) {
            expirePendingRequest(request, "Phiếu mượn đã quá giờ trả nhưng chưa được Admin duyệt.");
        }
    }

    public void reconcileDueReservations() {
        LocalDateTime now = UtcDateTimes.now();
        List<AssetBorrowRequest> readyRequests = repository.findReservedReadyToCheckout(now);
        for (AssetBorrowRequest request : readyRequests) {
            try {
                checkoutReserved(request.getId());
            } catch (RuntimeException exception) {
                log.warn("Cannot reconcile reserved borrow request #{} for asset {}: {}",
                        request.getId(),
                        request.getAsset() != null ? request.getAsset().getQaCode() : "unknown",
                        exception.getMessage());
            }
        }
    }

    private void validateAssetForBorrowRequest(Asset asset) {
        if (asset == null) {
            throw new CustomException("Không tìm thấy thiết bị.");
        }
        if ("CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode())) {
            throw new CustomException("Vật tư tiêu hao không hỗ trợ phiếu mượn thiết bị.");
        }
        String technicalStatus = AssetStatusSupport.resolveTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
        if (AssetStatusSupport.TECHNICAL_STATUS_BROKEN.equals(technicalStatus)) {
            throw new CustomException("Thiết bị đang hỏng, không thể tạo phiếu mượn.");
        }
        if (AssetStatusSupport.TECHNICAL_STATUS_LOST.equals(technicalStatus)) {
            throw new CustomException("Thiết bị đang thất lạc, không thể tạo phiếu mượn.");
        }
        if (asset.getHomeLocation() == null || asset.getLocation() == null) {
            throw new CustomException("Thiết bị chưa có thông tin vị trí đầy đủ để tạo phiếu mượn.");
        }
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

    private AssetBorrowRequest expirePendingRequest(AssetBorrowRequest request, String reason) {
        if (request == null || !"PENDING".equals(request.getStatus())) {
            return request;
        }
        request.setStatus("EXPIRED");
        request.setDecisionNote(reason);
        request.setLastOverdueReminderAt(null);
        AssetBorrowRequest saved = repository.save(request);
        updateInquiry(saved, InquiryStatusSupport.CANCELLED, reason, true);
        notificationService.createNotification(
                "BORROW_REQUEST_EXPIRED",
                "Phiếu mượn đã quá hạn duyệt",
                "Phiếu mượn #" + saved.getId() + " cho thiết bị " + saved.getAsset().getQaCode()
                        + " đã quá giờ trả nhưng chưa được Admin duyệt.",
                "system",
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of(
                        "Phiếu mượn", "#" + saved.getId(),
                        "Thiết bị", saved.getAsset().getQaCode() + " - " + saved.getAsset().getName(),
                        "Người yêu cầu", displayName(saved.getRequester()),
                        "Bắt đầu mượn", saved.getStartAt(),
                        "Hẹn trả", saved.getEndAt()
                ),
                List.of(
                        NotificationTarget.forRole("Admin", "/admin/borrow-requests"),
                        NotificationTarget.forUser(saved.getRequester().getId(), "/mobile/home")
                )
        );
        broadcast(saved);
        return saved;
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
                Map.of(
                        "Phiếu mượn", "#" + request.getId(),
                        "Trạng thái", request.getStatus(),
                        "Bắt đầu mượn", request.getStartAt(),
                        "Hẹn trả", request.getEndAt()
                ),
                List.of(NotificationTarget.forUser(request.getRequester().getId(), path)));
    }

    private void broadcast(AssetBorrowRequest request) {
        AssetBorrowRequestResponse payload = mapResponse(request);
        realtimePushService.pushToDestination(
                "/topic/users/" + request.getRequester().getId() + "/borrow-requests",
                payload);
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
                .homeLocationId(request.getAsset().getHomeLocation() != null ? request.getAsset().getHomeLocation().getId() : null)
                .homeLocationName(request.getAsset().getHomeLocation() != null ? request.getAsset().getHomeLocation().getRoomName() : null)
                .startAt(toOffset(request.getStartAt()))
                .endAt(toOffset(request.getEndAt()))
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
        if (user == null) {
            return "Người dùng";
        }
        return StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private String note(BorrowRequestDecisionRequest request) {
        return request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
    }

    private String normalizeAssetQaCode(String qaCode) {
        if (!StringUtils.hasText(qaCode)) {
            throw new CustomException("Mã QA thiết bị là bắt buộc.");
        }
        return qaCode.trim();
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(STORAGE_OFFSET);
    }
}
