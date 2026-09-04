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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AssetBorrowRequestService {

    private static final ZoneOffset STORAGE_OFFSET = ZoneOffset.UTC;
    private static final Set<String> ACTIVE_REQUEST_STATUSES = Set.of("PENDING", "CHECKED_OUT", "RETURN_PENDING");

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

        LocalDate neededFrom = request.getNeededFrom();
        LocalDate expectedReturnDate = request.getExpectedReturnDate();
        if (expectedReturnDate.isBefore(neededFrom)) {
            throw new CustomException("Ngày hẹn trả không được trước ngày bắt đầu mượn.");
        }
        if (repository.existsByAssetQaCodeAndRequesterIdAndStatusIn(
                asset.getQaCode(),
                requester.getId(),
                ACTIVE_REQUEST_STATUSES)) {
            throw new CustomException("Bạn đang có phiếu mượn đang chờ duyệt hoặc chưa trả cho thiết bị này.");
        }

        LocalDateTime now = UtcDateTimes.now();
        AssetBorrowRequest borrowRequest = AssetBorrowRequest.builder()
                .asset(asset)
                .requester(requester)
                .destinationLocation(destination)
                .neededFrom(neededFrom)
                .expectedReturnDate(expectedReturnDate)
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
                        "Ngày bắt đầu", saved.getNeededFrom(),
                        "Ngày hẹn trả", saved.getExpectedReturnDate(),
                        "Người yêu cầu", displayName(requester)
                ),
                List.of(NotificationTarget.forRole("Admin", "/admin/borrow-requests"))
        );
        broadcast(saved);
        return mapResponse(saved);
    }

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
        if (request.getNeededFrom() != null && request.getNeededFrom().isAfter(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw new CustomException("Phiếu đặt mượn chỉ có thể duyệt từ ngày bắt đầu mượn trở đi.");
        }

        usageHistoryService.checkout(CheckoutRequest.builder()
                .assetQaCode(request.getAsset().getQaCode())
                .userId(request.getRequester().getId())
                .toLocationId(request.getDestinationLocation().getId())
                .build());

        LocalDateTime now = UtcDateTimes.now();
        request.setStatus("CHECKED_OUT");
        request.setApprovedBy(admin);
        request.setApprovedAt(now);
        request.setCheckedOutAt(now);
        request.setDecisionNote(note(decision));
        request.setLastOverdueReminderAt(null);
        AssetBorrowRequest saved = repository.save(request);

        updateInquiry(saved, InquiryStatusSupport.WAITING_EMPLOYEE,
                "Phiếu mượn đã được duyệt.", false);
        notifyRequester(
                saved,
                "BORROW_REQUEST_APPROVED",
                "Phiếu mượn đã được duyệt",
                "Phiếu mượn #" + saved.getId() + " đã được " + displayName(admin) + " duyệt và bắt đầu tính thời gian mượn."
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
                        "Ngày bắt đầu", request.getNeededFrom(),
                        "Ngày hẹn trả", request.getExpectedReturnDate()
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
