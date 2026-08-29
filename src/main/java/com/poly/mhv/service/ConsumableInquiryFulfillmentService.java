package com.poly.mhv.service;

import com.poly.mhv.dto.asset.ConsumableRequestCreateRequest;
import com.poly.mhv.dto.asset.ConsumableRequestDecisionRequest;
import com.poly.mhv.dto.asset.ConsumableRequestResponse;
import com.poly.mhv.dto.inquiry.ConsumableFulfillmentQuantityRequest;
import com.poly.mhv.dto.inquiry.ConsumableFulfillmentWarehouseRequest;
import com.poly.mhv.dto.inquiry.ConsumableInquiryFulfillmentResponse;
import com.poly.mhv.dto.inquiry.InquiryActionRequest;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.AreaTypeCatalog;
import com.poly.mhv.entity.ConsumableInquiryFulfillment;
import com.poly.mhv.entity.ConsumableRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.ConsumableInquiryFulfillmentRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.ConsumableFulfillmentStatusSupport;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ConsumableInquiryFulfillmentService {

    private final ConsumableInquiryFulfillmentRepository fulfillmentRepository;
    private final ServiceInquiryRepository inquiryRepository;
    private final ConsumableRequestRepository consumableRequestRepository;
    private final LocationRepository locationRepository;
    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserProvider currentUserProvider;
    private final AssetService assetService;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;

    @Transactional(readOnly = true)
    public ConsumableInquiryFulfillmentResponse getByInquiryId(Long inquiryId) {
        ConsumableInquiryFulfillment fulfillment = fulfillmentRepository.findByInquiryId(inquiryId)
                .orElseThrow(() -> new CustomException("Yêu cầu chưa được chuyển thành phiếu cấp phát."));
        ensureCanView(fulfillment.getInquiry(), currentUserProvider.getCurrentUser());
        return mapResponse(fulfillment);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse adminApprove(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = currentUserProvider.getCurrentUser();
        requireRole(actor, "Admin", "Chỉ Admin được duyệt yêu cầu vượt ngưỡng.");
        if (!Boolean.TRUE.equals(fulfillment.getRequiresAdminApproval())) {
            throw new CustomException("Yêu cầu này không cần Admin phê duyệt.");
        }
        if (Boolean.TRUE.equals(fulfillment.getAdminApproved())) {
            throw new CustomException("Yêu cầu đã được Admin phê duyệt.");
        }
        ensureStatus(fulfillment, ConsumableFulfillmentStatusSupport.PENDING);
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setAdminApproved(true);
        fulfillment.setAdminApprovedBy(actor);
        fulfillment.setAdminApprovedAt(now);
        fulfillment.setDecisionNote(note(request));
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.CONVERTED);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyHandlers(inquiry, actor, "CONSUMABLE_ADMIN_APPROVED", "Yêu cầu cấp vật tư đã được Admin duyệt",
                "Yêu cầu #" + inquiry.getId() + " đã đủ điều kiện để chuẩn bị vật tư.");
        notifyRequester(inquiry, actor, "CONSUMABLE_ADMIN_APPROVED", "Yêu cầu đã được duyệt",
                "Admin đã phê duyệt yêu cầu cấp vật tư #" + inquiry.getId() + ".");
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse transferWarehouse(
            Long fulfillmentId,
            ConsumableFulfillmentWarehouseRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = requireAssignedManager(fulfillment.getInquiry());
        ensureOpen(fulfillment);
        ensureApproval(fulfillment);
        if (!List.of(ConsumableFulfillmentStatusSupport.PENDING,
                ConsumableFulfillmentStatusSupport.PARTIALLY_FULFILLED).contains(fulfillment.getStatus())) {
            throw new CustomException("Chỉ được đổi kho trước khi bắt đầu chuẩn bị đợt cấp phát.");
        }
        Location warehouse = getStorageWarehouse(request.getWarehouseLocationId());
        ConsumableRequest activeRequest = getActiveRequest(fulfillment);
        activeRequest.setSourceWarehouseLocation(warehouse);
        consumableRequestRepository.save(activeRequest);
        fulfillment.setSourceWarehouseLocation(warehouse);
        fulfillment.setUpdatedAt(UtcDateTimes.now());
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyRequester(fulfillment.getInquiry(), actor, "CONSUMABLE_WAREHOUSE_CHANGED", "Đã cập nhật kho xuất",
                "Yêu cầu #" + fulfillment.getInquiry().getId() + " sẽ được chuẩn bị tại " + warehouse.getRoomName() + ".");
        broadcast(fulfillment.getInquiry());
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse prepare(
            Long fulfillmentId,
            ConsumableFulfillmentQuantityRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = requireAssignedManager(fulfillment.getInquiry());
        ensureOpen(fulfillment);
        ensureApproval(fulfillment);
        if (!List.of(ConsumableFulfillmentStatusSupport.PENDING,
                ConsumableFulfillmentStatusSupport.PARTIALLY_FULFILLED).contains(fulfillment.getStatus())) {
            throw new CustomException("Yêu cầu không ở trạng thái có thể chuẩn bị.");
        }
        int remaining = remaining(fulfillment);
        int quantity = request != null && request.getQuantity() != null ? request.getQuantity() : remaining;
        if (quantity <= 0 || quantity > remaining) {
            throw new CustomException("Số lượng chuẩn bị phải lớn hơn 0 và không vượt quá số lượng còn lại.");
        }
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setPreparedQuantity(quantity);
        fulfillment.setPreparedBy(actor);
        fulfillment.setPreparedAt(now);
        fulfillment.setReadyAt(null);
        fulfillment.setDecisionNote(request != null ? clean(request.getNote()) : null);
        fulfillment.setStatus(ConsumableFulfillmentStatusSupport.PREPARING);
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.IN_PROGRESS);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyRequester(inquiry, actor, "CONSUMABLE_PREPARING", "Vật tư đang được chuẩn bị",
                "Đang chuẩn bị " + quantity + " đơn vị cho yêu cầu #" + inquiry.getId() + ".");
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse markReady(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = requireAssignedManager(fulfillment.getInquiry());
        ensureStatus(fulfillment, ConsumableFulfillmentStatusSupport.PREPARING);
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setStatus(ConsumableFulfillmentStatusSupport.READY_FOR_PICKUP);
        fulfillment.setReadyAt(now);
        fulfillment.setDecisionNote(preferNote(request, fulfillment.getDecisionNote()));
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.IN_PROGRESS);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyRequester(inquiry, actor, "CONSUMABLE_READY", "Vật tư đã sẵn sàng",
                "Vật tư của yêu cầu #" + inquiry.getId() + " đã sẵn sàng tại "
                        + fulfillment.getSourceWarehouseLocation().getRoomName() + ".");
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse fulfill(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = requireAssignedManager(fulfillment.getInquiry());
        ensureStatus(fulfillment, ConsumableFulfillmentStatusSupport.READY_FOR_PICKUP);
        int quantity = fulfillment.getPreparedQuantity() == null ? 0 : fulfillment.getPreparedQuantity();
        if (quantity <= 0 || quantity > remaining(fulfillment)) {
            throw new CustomException("Số lượng đã chuẩn bị không hợp lệ.");
        }
        String decisionNote = preferNote(request, fulfillment.getDecisionNote());
        assetService.fulfillConsumableRequest(
                fulfillment.getActiveConsumableRequestId(),
                quantity,
                ConsumableRequestDecisionRequest.builder()
                        .sourceWarehouseLocationId(fulfillment.getSourceWarehouseLocation().getId())
                        .note(decisionNote)
                        .build());

        LocalDateTime now = UtcDateTimes.now();
        int fulfilledQuantity = safe(fulfillment.getFulfilledQuantity()) + quantity;
        fulfillment.setFulfilledQuantity(fulfilledQuantity);
        fulfillment.setPreparedQuantity(null);
        fulfillment.setDecisionNote(decisionNote);
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        int remaining = Math.max(0, fulfillment.getRequestedQuantity() - fulfilledQuantity);
        if (remaining == 0) {
            fulfillment.setStatus(ConsumableFulfillmentStatusSupport.FULFILLED);
            fulfillment.setFulfilledAt(now);
            inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
            inquiry.setDecisionNote("Đã cấp đủ vật tư, chờ nhân viên xác nhận đã nhận.");
        } else {
            ConsumableRequestResponse nextRequest = assetService.createConsumableRequestForRequester(
                    inquiry.getDestinationLocation().getId(),
                    ConsumableRequestCreateRequest.builder()
                            .assetQaCode(inquiry.getAlternativeAsset() != null
                                    && Boolean.TRUE.equals(inquiry.getAlternativeAccepted())
                                    ? inquiry.getAlternativeAsset().getQaCode()
                                    : inquiry.getAsset().getQaCode())
                            .sourceWarehouseLocationId(fulfillment.getSourceWarehouseLocation().getId())
                            .quantityRequested(remaining)
                            .reason("Phần còn lại của yêu cầu hội thoại #" + inquiry.getId())
                            .build(),
                    inquiry.getRequester());
            fulfillment.setActiveConsumableRequestId(nextRequest.getId());
            fulfillment.setStatus(ConsumableFulfillmentStatusSupport.PARTIALLY_FULFILLED);
            inquiry.setStatus(InquiryStatusSupport.CONVERTED);
            inquiry.setDecisionNote("Đã cấp " + fulfilledQuantity + "/" + fulfillment.getRequestedQuantity()
                    + ", còn " + remaining + ".");
        }
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        String message = remaining == 0
                ? "Đã cấp đủ " + fulfilledQuantity + " đơn vị cho yêu cầu #" + inquiry.getId() + "."
                : "Đã cấp " + fulfilledQuantity + "/" + fulfillment.getRequestedQuantity()
                        + " đơn vị; phần còn lại tiếp tục được xử lý.";
        notifyRequester(inquiry, actor, "CONSUMABLE_FULFILLED", "Đã ghi nhận cấp vật tư", message);
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse closePartial(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = requireAssignedManager(fulfillment.getInquiry());
        ensureOpen(fulfillment);
        ensureStatus(fulfillment, ConsumableFulfillmentStatusSupport.PARTIALLY_FULFILLED);
        if (safe(fulfillment.getFulfilledQuantity()) <= 0 || remaining(fulfillment) <= 0) {
            throw new CustomException("Yêu cầu không có phần cấp phát dở dang để kết thúc.");
        }
        String note = note(request);
        if (!StringUtils.hasText(note)) {
            throw new CustomException("Vui lòng nhập lý do kết thúc cấp phát một phần.");
        }
        rejectActiveRequest(fulfillment, "Không tiếp tục cấp phần còn lại. " + note);
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setClosedPartial(true);
        fulfillment.setDecisionNote(note);
        fulfillment.setFulfilledAt(now);
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
        inquiry.setDecisionNote("Cấp một phần " + fulfillment.getFulfilledQuantity() + "/"
                + fulfillment.getRequestedQuantity() + ". " + note);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyRequester(inquiry, actor, "CONSUMABLE_PARTIAL_CLOSED", "Yêu cầu được cấp một phần",
                inquiry.getDecisionNote());
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse reject(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = currentUserProvider.getCurrentUser();
        boolean admin = "Admin".equals(actor.getRole());
        if (!admin) {
            requireAssignedManager(fulfillment.getInquiry());
        }
        if (safe(fulfillment.getFulfilledQuantity()) > 0) {
            throw new CustomException("Yêu cầu đã cấp một phần; hãy dùng chức năng kết thúc cấp một phần.");
        }
        if (ConsumableFulfillmentStatusSupport.isTerminal(fulfillment.getStatus())) {
            throw new CustomException("Yêu cầu đã kết thúc.");
        }
        String note = note(request);
        if (!StringUtils.hasText(note)) {
            throw new CustomException("Vui lòng nhập lý do từ chối.");
        }
        rejectActiveRequest(fulfillment, note);
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setStatus(ConsumableFulfillmentStatusSupport.REJECTED);
        fulfillment.setDecisionNote(note);
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.REJECTED);
        inquiry.setDecisionNote(note);
        inquiry.setCompletedAt(now);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyRequester(inquiry, actor, "CONSUMABLE_REJECTED", "Yêu cầu cấp vật tư bị từ chối", note);
        broadcast(inquiry);
        return mapResponse(saved);
    }

    @Transactional
    public ConsumableInquiryFulfillmentResponse cancel(Long fulfillmentId, InquiryActionRequest request) {
        ConsumableInquiryFulfillment fulfillment = getForUpdate(fulfillmentId);
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!fulfillment.getInquiry().getRequester().getId().equals(actor.getId())) {
            throw new AccessDeniedException("Chỉ người tạo yêu cầu được hủy phiếu này.");
        }
        if (!ConsumableFulfillmentStatusSupport.PENDING.equals(fulfillment.getStatus())
                || safe(fulfillment.getFulfilledQuantity()) > 0) {
            throw new CustomException("Chỉ có thể hủy trước khi bộ phận vật tư bắt đầu chuẩn bị.");
        }
        String cancellationNote = StringUtils.hasText(note(request))
                ? note(request)
                : "Người yêu cầu đã hủy phiếu cấp phát.";
        rejectActiveRequest(fulfillment, cancellationNote);
        LocalDateTime now = UtcDateTimes.now();
        fulfillment.setStatus(ConsumableFulfillmentStatusSupport.CANCELLED);
        fulfillment.setDecisionNote(cancellationNote);
        fulfillment.setUpdatedAt(now);
        ServiceInquiry inquiry = fulfillment.getInquiry();
        inquiry.setStatus(InquiryStatusSupport.CANCELLED);
        inquiry.setDecisionNote(cancellationNote);
        inquiry.setCompletedAt(now);
        inquiry.setUpdatedAt(now);
        inquiryRepository.save(inquiry);
        ConsumableInquiryFulfillment saved = fulfillmentRepository.save(fulfillment);
        notifyHandlers(inquiry, actor, "CONSUMABLE_CANCELLED", "Yêu cầu cấp vật tư đã bị hủy",
                "Yêu cầu #" + inquiry.getId() + " đã được nhân viên hủy.");
        broadcast(inquiry);
        return mapResponse(saved);
    }

    private ConsumableInquiryFulfillment getForUpdate(Long id) {
        return fulfillmentRepository.findForUpdateById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy tiến độ cấp phát."));
    }

    private AppUser requireAssignedManager(ServiceInquiry inquiry) {
        AppUser actor = currentUserProvider.getCurrentUser();
        requireRole(actor, "ConsumableManager", "Chỉ quản lý vật tư được thực hiện thao tác này.");
        if (inquiry.getAssignee() == null || !actor.getId().equals(inquiry.getAssignee().getId())) {
            throw new AccessDeniedException("Bạn phải là người đang nhận xử lý yêu cầu này.");
        }
        return actor;
    }

    private void ensureCanView(ServiceInquiry inquiry, AppUser actor) {
        boolean requester = inquiry.getRequester().getId().equals(actor.getId());
        boolean admin = "Admin".equals(actor.getRole());
        boolean targetHandler = inquiry.getTargetRole().equals(actor.getRole());
        if (!requester && !admin && !targetHandler) {
            throw new AccessDeniedException("Bạn không có quyền xem tiến độ cấp phát này.");
        }
    }

    private void requireRole(AppUser actor, String role, String message) {
        if (actor == null || !role.equals(actor.getRole())) {
            throw new AccessDeniedException(message);
        }
    }

    private void ensureApproval(ConsumableInquiryFulfillment fulfillment) {
        if (Boolean.TRUE.equals(fulfillment.getRequiresAdminApproval())
                && !Boolean.TRUE.equals(fulfillment.getAdminApproved())) {
            throw new CustomException("Yêu cầu đang chờ Admin phê duyệt.");
        }
    }

    private void ensureOpen(ConsumableInquiryFulfillment fulfillment) {
        if (Boolean.TRUE.equals(fulfillment.getClosedPartial())
                || ConsumableFulfillmentStatusSupport.isTerminal(fulfillment.getStatus())) {
            throw new CustomException("Tiến độ cấp phát đã kết thúc.");
        }
    }

    private void ensureStatus(ConsumableInquiryFulfillment fulfillment, String expected) {
        if (!expected.equals(fulfillment.getStatus())) {
            throw new CustomException("Trạng thái hiện tại không cho phép thao tác này.");
        }
    }

    private ConsumableRequest getActiveRequest(ConsumableInquiryFulfillment fulfillment) {
        return consumableRequestRepository.findById(fulfillment.getActiveConsumableRequestId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu cấp phát đang hoạt động."));
    }

    private void rejectActiveRequest(ConsumableInquiryFulfillment fulfillment, String note) {
        ConsumableRequest active = getActiveRequest(fulfillment);
        if ("PENDING".equalsIgnoreCase(active.getStatus())) {
            assetService.rejectConsumableRequest(active.getId(), ConsumableRequestDecisionRequest.builder()
                    .note(note)
                    .build());
        }
    }

    private Location getStorageWarehouse(Integer warehouseId) {
        Location location = locationRepository.findById(warehouseId)
                .orElseThrow(() -> new CustomException("Không tìm thấy kho xuất."));
        AreaTypeCatalog areaType = StringUtils.hasText(location.getAreaTypeKey())
                ? areaTypeCatalogRepository.findByTypeKeyIgnoreCase(location.getAreaTypeKey()).orElse(null)
                : null;
        if (areaType == null || !Boolean.TRUE.equals(areaType.getIsStorageWarehouse())) {
            throw new CustomException("Địa điểm đã chọn không phải kho lưu trữ vật tư.");
        }
        return location;
    }

    private int remaining(ConsumableInquiryFulfillment fulfillment) {
        return Math.max(0, safe(fulfillment.getRequestedQuantity()) - safe(fulfillment.getFulfilledQuantity()));
    }

    private int safe(Integer value) {
        return value == null ? 0 : value;
    }

    private String note(InquiryActionRequest request) {
        return request == null ? null : clean(request.getNote());
    }

    private String preferNote(InquiryActionRequest request, String fallback) {
        String supplied = note(request);
        return StringUtils.hasText(supplied) ? supplied : fallback;
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private ConsumableInquiryFulfillmentResponse mapResponse(ConsumableInquiryFulfillment fulfillment) {
        AppUser approvedBy = fulfillment.getAdminApprovedBy();
        AppUser preparedBy = fulfillment.getPreparedBy();
        return ConsumableInquiryFulfillmentResponse.builder()
                .id(fulfillment.getId())
                .inquiryId(fulfillment.getInquiry().getId())
                .originalConsumableRequestId(fulfillment.getOriginalConsumableRequestId())
                .activeConsumableRequestId(fulfillment.getActiveConsumableRequestId())
                .sourceWarehouseLocationId(fulfillment.getSourceWarehouseLocation().getId())
                .sourceWarehouseLocationName(fulfillment.getSourceWarehouseLocation().getRoomName())
                .requestedQuantity(fulfillment.getRequestedQuantity())
                .fulfilledQuantity(safe(fulfillment.getFulfilledQuantity()))
                .remainingQuantity(remaining(fulfillment))
                .preparedQuantity(fulfillment.getPreparedQuantity())
                .status(fulfillment.getStatus())
                .requiresAdminApproval(fulfillment.getRequiresAdminApproval())
                .adminApproved(fulfillment.getAdminApproved())
                .adminApprovedByUserId(approvedBy != null ? approvedBy.getId() : null)
                .adminApprovedByName(displayName(approvedBy))
                .preparedByUserId(preparedBy != null ? preparedBy.getId() : null)
                .preparedByName(displayName(preparedBy))
                .closedPartial(fulfillment.getClosedPartial())
                .decisionNote(fulfillment.getDecisionNote())
                .createdAt(toOffset(fulfillment.getCreatedAt()))
                .adminApprovedAt(toOffset(fulfillment.getAdminApprovedAt()))
                .preparedAt(toOffset(fulfillment.getPreparedAt()))
                .readyAt(toOffset(fulfillment.getReadyAt()))
                .fulfilledAt(toOffset(fulfillment.getFulfilledAt()))
                .updatedAt(toOffset(fulfillment.getUpdatedAt()))
                .build();
    }

    private void notifyRequester(ServiceInquiry inquiry, AppUser actor, String event, String title, String message) {
        notificationService.createNotification(event, title, message, actor.getUsername(),
                inquiry.getAsset().getQaCode(), inquiry.getAsset().getName(), details(inquiry),
                List.of(NotificationTarget.forUser(inquiry.getRequester().getId(),
                        "/mobile/inquiries/" + inquiry.getId())));
    }

    private void notifyHandlers(ServiceInquiry inquiry, AppUser actor, String event, String title, String message) {
        NotificationTarget target = inquiry.getAssignee() != null
                ? NotificationTarget.forUser(inquiry.getAssignee().getId(), "/supply/inquiries/" + inquiry.getId())
                : NotificationTarget.forRole("ConsumableManager", "/supply/inquiries/" + inquiry.getId());
        notificationService.createNotification(event, title, message, actor.getUsername(),
                inquiry.getAsset().getQaCode(), inquiry.getAsset().getName(), details(inquiry), List.of(target));
    }

    private Map<String, Object> details(ServiceInquiry inquiry) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("Yêu cầu", "#" + inquiry.getId());
        detail.put("Vật tư", inquiry.getAsset().getQaCode() + " - " + inquiry.getAsset().getName());
        detail.put("Người yêu cầu", displayName(inquiry.getRequester()));
        detail.put("Trạng thái", inquiry.getStatus());
        return detail;
    }

    private void broadcast(ServiceInquiry inquiry) {
        List<Integer> userIds = new ArrayList<>();
        userIds.add(inquiry.getRequester().getId());
        if (inquiry.getAssignee() != null) {
            userIds.add(inquiry.getAssignee().getId());
        } else {
            appUserRepository.findByRole("ConsumableManager").stream()
                    .filter(user -> "Hoạt động".equals(user.getStatus()))
                    .map(AppUser::getId)
                    .forEach(userIds::add);
        }
        appUserRepository.findByRole("Admin").stream()
                .filter(user -> "Hoạt động".equals(user.getStatus()))
                .map(AppUser::getId)
                .forEach(userIds::add);
        Map<String, Object> payload = Map.of(
                "inquiryId", inquiry.getId(),
                "status", inquiry.getStatus(),
                "updatedAt", toOffset(inquiry.getUpdatedAt()));
        userIds.stream().distinct().forEach(id -> realtimePushService
                .pushToDestination("/topic/users/" + id + "/inquiry-updates", payload));
    }

    private String displayName(AppUser user) {
        if (user == null) {
            return null;
        }
        return StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }
}
