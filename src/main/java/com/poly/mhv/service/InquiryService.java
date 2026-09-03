package com.poly.mhv.service;

import com.poly.mhv.dto.asset.ConsumableRequestCreateRequest;
import com.poly.mhv.dto.asset.ConsumableRequestResponse;
import com.poly.mhv.dto.inquiry.InquiryActionRequest;
import com.poly.mhv.dto.inquiry.InquiryAlternativeRequest;
import com.poly.mhv.dto.inquiry.InquiryAvailabilityResponse;
import com.poly.mhv.dto.inquiry.InquiryConsumableConversionRequest;
import com.poly.mhv.dto.inquiry.InquiryCreateRequest;
import com.poly.mhv.dto.inquiry.InquiryLocationOptionResponse;
import com.poly.mhv.dto.inquiry.InquiryMediaUploadResponse;
import com.poly.mhv.dto.inquiry.InquiryMessageResponse;
import com.poly.mhv.dto.inquiry.InquiryMessageSendRequest;
import com.poly.mhv.dto.inquiry.InquiryOptionsResponse;
import com.poly.mhv.dto.inquiry.InquiryResponse;
import com.poly.mhv.dto.inquiry.InquiryTransferRequest;
import com.poly.mhv.dto.inquiry.InquiryUserOptionResponse;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ConsumableInquiryFulfillment;
import com.poly.mhv.entity.InquiryMessage;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ConsumableInquiryFulfillmentRepository;
import com.poly.mhv.repository.InquiryMessageRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class InquiryService {

    private static final ZoneOffset STORAGE_OFFSET = ZoneOffset.UTC;

    private final ServiceInquiryRepository inquiryRepository;
    private final InquiryMessageRepository messageRepository;
    private final AssetBorrowRequestRepository borrowRequestRepository;
    private final AssetRepository assetRepository;
    private final LocationRepository locationRepository;
    private final AppUserRepository appUserRepository;
    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final CurrentUserProvider currentUserProvider;
    private final InquiryMediaStorageService mediaStorageService;
    private final AssetService assetService;
    private final NotificationService notificationService;
    private final AsyncRealtimePushService realtimePushService;
    private final InquiryWorkflowSettingService workflowSettingService;
    private final ConsumableInquiryFulfillmentRepository consumableFulfillmentRepository;

    @Transactional(readOnly = true)
    public List<InquiryAvailabilityResponse> searchAvailability(
            String keyword,
            String trackingMode,
            Integer categoryId,
            Integer locationId,
            Integer limit) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedMode = normalizeTrackingMode(trackingMode);
        int boundedLimit = Math.max(1, Math.min(limit == null ? 30 : limit, 100));
        return assetRepository.searchForInquiry(
                        normalizedKeyword,
                        normalizedMode,
                        categoryId,
                        locationId,
                        PageRequest.of(0, boundedLimit)).stream()
                .map(this::mapAvailability)
                .toList();
    }

    @Transactional(readOnly = true)
    public InquiryOptionsResponse getOptions() {
        AppUser actor = currentUserProvider.getCurrentUser();
        Set<String> storageWarehouseTypeKeys = areaTypeCatalogRepository
                .findByIsStorageWarehouseTrueOrderBySortOrderAscLabelAsc()
                .stream()
                .map(areaType -> areaType.getTypeKey().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        List<InquiryLocationOptionResponse> locations = locationRepository.findAll().stream()
                .sorted(Comparator.comparing(Location::getRoomName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(location -> InquiryLocationOptionResponse.builder()
                        .id(location.getId())
                        .name(location.getRoomName())
                        .areaTypeKey(location.getAreaTypeKey())
                        .areaTypeLabel(location.getAreaTypeLabel())
                        .storageWarehouse(StringUtils.hasText(location.getAreaTypeKey())
                                && storageWarehouseTypeKeys.contains(location.getAreaTypeKey().toLowerCase(Locale.ROOT)))
                        .build())
                .toList();
        List<InquiryUserOptionResponse> handlers = List.of();
        if (List.of("Admin", "ConsumableManager").contains(actor.getRole())) {
            handlers = appUserRepository.findByRole(actor.getRole()).stream()
                    .filter(user -> "Hoạt động".equals(user.getStatus()))
                    .sorted(Comparator.comparing(this::displayName, String.CASE_INSENSITIVE_ORDER))
                    .map(user -> InquiryUserOptionResponse.builder()
                            .id(user.getId())
                            .username(user.getUsername())
                            .fullName(user.getFullName())
                            .role(user.getRole())
                            .build())
                    .toList();
        }
        return InquiryOptionsResponse.builder().locations(locations).handlers(handlers).build();
    }

    @Transactional
    public InquiryResponse create(InquiryCreateRequest request) {
        AppUser requester = currentUserProvider.getCurrentUser();
        if (!"NhanVien".equals(requester.getRole())) {
            throw new AccessDeniedException("Chỉ nhân viên mới được tạo yêu cầu cấp phát.");
        }
        Asset asset = assetRepository.findDetailByQaCode(normalizeAssetQaCode(request.getAssetQaCode()))
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị hoặc vật tư đã chọn."));
        Location destination = locationRepository.findById(request.getDestinationLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng sử dụng hoặc phòng nhận."));
        boolean consumable = isConsumable(asset);
        if (!consumable) {
            throw new CustomException("Thiết bị không còn tạo yêu cầu mượn ở màn này. Vui lòng dùng chức năng Mượn/Trả bằng QR.");
        }
        String quantityRequestedUnit = normalizeInquiryQuantityUnit(request.getQuantityRequestedUnit());
        int quantityInput = safePositive(request.getQuantityRequested(), 1);
        int quantity = assetService.convertConsumableQuantityToRetail(asset, quantityInput, quantityRequestedUnit);
        if (safeQuantity(asset.getQuantityOnHand()) < quantity) {
            throw new CustomException(
                    "Số lượng tồn kho hiện không đủ. Hiện còn "
                            + formatInquiryConsumableQuantity(asset, asset.getQuantityOnHand())
                            + "."
            );
        }
        LocalDate neededFrom = request.getNeededFrom();
        LocalDate expectedReturn = null;
        if (expectedReturn != null && expectedReturn.isBefore(neededFrom)) {
            throw new CustomException("Ngày dự kiến trả không được trước ngày cần sử dụng.");
        }
        LocalDateTime now = UtcDateTimes.now();
        InquiryWorkflowSettingService.EffectiveSettings workflowSettings = workflowSettingService.getEffectiveSettings();
        ServiceInquiry inquiry = ServiceInquiry.builder()
                .inquiryType(InquiryStatusSupport.CONSUMABLE_REQUEST)
                .requester(requester)
                .targetRole("ConsumableManager")
                .asset(asset)
                .quantityRequested(quantity)
                .quantityRequestedInput(quantityInput)
                .quantityRequestedUnit(quantityRequestedUnit)
                .destinationLocation(destination)
                .neededFrom(neededFrom)
                .expectedReturnDate(expectedReturn)
                .purpose(request.getPurpose().trim())
                .status(InquiryStatusSupport.NEW)
                .alternativeAccepted(false)
                .createdAt(now)
                .updatedAt(now)
                .slaResponseDueAt(now.plusMinutes(workflowSettings.consumableResponseSlaMinutes()))
                .overdueReminderCount(0)
                .build();
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        if (StringUtils.hasText(request.getMessage())) {
            saveMessageEntity(saved, requester, request.getMessage().trim(), null, null, now);
        }
        notifyCreated(saved);
        return mapInquiry(saved, requester);
    }

    @Transactional(readOnly = true)
    public List<InquiryResponse> getMine() {
        AppUser actor = currentUserProvider.getCurrentUser();
        return inquiryRepository.findByRequesterIdOrderByUpdatedAtDesc(actor.getId()).stream()
                .filter(inquiry -> InquiryStatusSupport.CONSUMABLE_REQUEST.equals(inquiry.getInquiryType()))
                .map(inquiry -> mapInquiry(inquiry, actor))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InquiryResponse> getInbox(String status) {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!List.of("Admin", "ConsumableManager").contains(actor.getRole())) {
            throw new AccessDeniedException("Bạn không có quyền xem hộp thư yêu cầu.");
        }
        String normalizedStatus = normalizeStatus(status);
        List<ServiceInquiry> inbox = "Admin".equals(actor.getRole())
                ? inquiryRepository.findAdminInbox(normalizedStatus)
                : inquiryRepository.findInbox(actor.getRole(), normalizedStatus);
        return inbox.stream()
                .filter(inquiry -> InquiryStatusSupport.CONSUMABLE_REQUEST.equals(inquiry.getInquiryType()))
                .map(inquiry -> mapInquiry(inquiry, actor))
                .toList();
    }

    @Transactional(readOnly = true)
    public InquiryResponse getById(Long inquiryId) {
        ServiceInquiry inquiry = getDetail(inquiryId);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanView(inquiry, actor);
        return mapInquiry(inquiry, actor);
    }

    @Transactional
    public List<InquiryMessageResponse> getMessages(Long inquiryId) {
        ServiceInquiry inquiry = getDetail(inquiryId);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanView(inquiry, actor);
        markReadInternal(inquiry, actor);
        return messageRepository.findByInquiryIdOrderByCreatedAtAscIdAsc(inquiryId).stream()
                .map(this::mapMessage)
                .toList();
    }

    @Transactional
    public InquiryMessageResponse sendMessage(Long inquiryId, InquiryMessageSendRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanMessage(inquiry, actor);
        if (InquiryStatusSupport.isTerminal(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu đã kết thúc. Bạn chỉ có thể xem lại lịch sử trao đổi.");
        }
        String content = request != null && StringUtils.hasText(request.getContent()) ? request.getContent().trim() : null;
        String mediaUrl = request != null && StringUtils.hasText(request.getMediaUrl())
                ? mediaStorageService.normalizeTrustedUrl(request.getMediaUrl().trim())
                : null;
        String mediaType = request != null && StringUtils.hasText(request.getMediaType())
                ? request.getMediaType().trim().toLowerCase(Locale.ROOT)
                : null;
        if (content == null && mediaUrl == null) {
            throw new CustomException("Tin nhắn hoặc ảnh đính kèm là bắt buộc.");
        }
        if (mediaUrl != null && !"image".equals(mediaType)) {
            throw new CustomException("Loại media của yêu cầu không hợp lệ.");
        }
        LocalDateTime now = UtcDateTimes.now();
        InquiryMessage saved = saveMessageEntity(inquiry, actor, content, mediaUrl, mediaType, now);
        inquiry.setUpdatedAt(now);
        if (!isRequester(inquiry, actor)) {
            recordFirstResponse(inquiry, now);
        }
        if (!StringUtils.hasText(inquiry.getLinkedEntityType()) && inquiry.getLinkedEntityId() == null) {
            if (isRequester(inquiry, actor)) {
                if (InquiryStatusSupport.WAITING_EMPLOYEE.equals(inquiry.getStatus())) {
                    inquiry.setStatus(InquiryStatusSupport.IN_PROGRESS);
                }
            } else {
                inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
            }
        }
        inquiryRepository.save(inquiry);
        InquiryMessageResponse response = mapMessage(saved);
        broadcastMessage(inquiry, response, actor);
        notifyMessage(inquiry, actor, content != null ? content : "[Ảnh]");
        return response;
    }

    @Transactional(readOnly = true)
    public InquiryMediaUploadResponse uploadMedia(Long inquiryId, MultipartFile file) {
        ServiceInquiry inquiry = getDetail(inquiryId);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanMessage(inquiry, actor);
        if (InquiryStatusSupport.isTerminal(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu đã kết thúc. Không thể tải thêm ảnh.");
        }
        InquiryMediaStorageService.StoredInquiryMedia stored = mediaStorageService.storeImage(file);
        return InquiryMediaUploadResponse.builder()
                .mediaUrl(stored.mediaUrl())
                .mediaType(stored.mediaType())
                .build();
    }

    @Transactional
    public InquiryResponse markRead(Long inquiryId) {
        ServiceInquiry inquiry = getDetail(inquiryId);
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureCanView(inquiry, actor);
        markReadInternal(inquiry, actor);
        return mapInquiry(inquiry, actor);
    }

    @Transactional
    public InquiryResponse claim(Long inquiryId) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureTargetRole(inquiry, actor);
        if (InquiryStatusSupport.isTerminal(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu đã kết thúc.");
        }
        if (inquiry.getAssignee() != null && !actor.getId().equals(inquiry.getAssignee().getId())) {
            throw new CustomException("Yêu cầu đã được " + displayName(inquiry.getAssignee()) + " nhận xử lý.");
        }
        LocalDateTime now = UtcDateTimes.now();
        recordFirstResponse(inquiry, now);
        inquiry.setAssignee(actor);
        inquiry.setClaimedAt(inquiry.getClaimedAt() == null ? now : inquiry.getClaimedAt());
        inquiry.setUpdatedAt(now);
        if (InquiryStatusSupport.NEW.equals(inquiry.getStatus())) {
            inquiry.setStatus(InquiryStatusSupport.CLAIMED);
        }
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyRequester(saved, "INQUIRY_CLAIMED", "Yêu cầu đã có người tiếp nhận",
                displayName(actor) + " đã nhận xử lý yêu cầu của bạn.");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse transfer(Long inquiryId, InquiryTransferRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureTargetRole(inquiry, actor);
        AppUser nextAssignee = appUserRepository.findById(request.getAssigneeUserId())
                .orElseThrow(() -> new CustomException("Không tìm thấy người nhận xử lý."));
        if (!inquiry.getTargetRole().equals(nextAssignee.getRole()) || !"Hoạt động".equals(nextAssignee.getStatus())) {
            throw new CustomException("Người được chuyển không thuộc nhóm xử lý phù hợp hoặc đang ngừng hoạt động.");
        }
        LocalDateTime now = UtcDateTimes.now();
        recordFirstResponse(inquiry, now);
        inquiry.setAssignee(nextAssignee);
        inquiry.setClaimedAt(inquiry.getClaimedAt() == null ? now : inquiry.getClaimedAt());
        inquiry.setUpdatedAt(now);
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notificationService.createNotification(
                "INQUIRY_TRANSFERRED",
                "Bạn được chuyển một yêu cầu hỗ trợ",
                displayName(actor) + " đã chuyển yêu cầu #" + inquiryId + " cho bạn.",
                actor.getUsername(),
                saved.getAsset().getQaCode(),
                saved.getAsset().getName(),
                Map.of("Yêu cầu", "#" + inquiryId),
                List.of(NotificationTarget.forUser(nextAssignee.getId(), roleDetailPath(saved))));
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse cancel(Long inquiryId, InquiryActionRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!isRequester(inquiry, actor)) {
            throw new AccessDeniedException("Bạn không có quyền hủy yêu cầu này.");
        }
        if (StringUtils.hasText(inquiry.getLinkedEntityType()) || InquiryStatusSupport.isTerminal(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu đã được xử lý hoặc chuyển thành phiếu nghiệp vụ nên không thể hủy.");
        }
        finishInquiry(inquiry, InquiryStatusSupport.CANCELLED, note(request));
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyTarget(saved, actor, "INQUIRY_CANCELLED", "Yêu cầu đã bị hủy",
                displayName(actor) + " đã hủy yêu cầu #" + inquiryId + ".");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse close(Long inquiryId, InquiryActionRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureAssignedHandler(inquiry, actor);
        recordFirstResponse(inquiry, UtcDateTimes.now());
        finishInquiry(inquiry, InquiryStatusSupport.COMPLETED, note(request));
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyRequester(saved, "INQUIRY_COMPLETED", "Yêu cầu đã hoàn tất",
                displayName(actor) + " đã hoàn tất yêu cầu của bạn.");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse reject(Long inquiryId, InquiryActionRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureAssignedHandler(inquiry, actor);
        String rejectionReason = note(request);
        if (!StringUtils.hasText(rejectionReason)) {
            throw new CustomException("Vui lòng nhập lý do từ chối.");
        }
        recordFirstResponse(inquiry, UtcDateTimes.now());
        finishInquiry(inquiry, InquiryStatusSupport.REJECTED, rejectionReason);
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyRequester(saved, "INQUIRY_REJECTED", "Yêu cầu đã bị từ chối", rejectionReason);
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse proposeAlternative(Long inquiryId, InquiryAlternativeRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureAssignedHandler(inquiry, actor);
        Asset alternative = assetRepository.findDetailByQaCode(normalizeAssetQaCode(request.getAlternativeAssetQaCode()))
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị hoặc vật tư thay thế."));
        String originalTrackingMode = normalizeTrackingMode(inquiry.getAsset().getTrackingMode());
        String alternativeTrackingMode = normalizeTrackingMode(alternative.getTrackingMode());
        if (originalTrackingMode == null || !originalTrackingMode.equals(alternativeTrackingMode)) {
            throw new CustomException("Đối tượng thay thế phải cùng loại tài sản hoặc vật tư với yêu cầu ban đầu.");
        }
        recordFirstResponse(inquiry, UtcDateTimes.now());
        inquiry.setAlternativeAsset(alternative);
        inquiry.setProposedQuantity(isConsumable(alternative) ? safePositive(request.getProposedQuantity(), inquiry.getQuantityRequested()) : 1);
        inquiry.setAlternativeAccepted(false);
        inquiry.setDecisionNote(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null);
        inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
        inquiry.setUpdatedAt(UtcDateTimes.now());
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyRequester(saved, "INQUIRY_ALTERNATIVE_PROPOSED", "Có phương án thay thế",
                displayName(actor) + " đề xuất " + alternative.getQaCode() + " - " + alternative.getName() + ".");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse acceptAlternative(Long inquiryId) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!isRequester(inquiry, actor)) {
            throw new AccessDeniedException("Bạn không có quyền xác nhận phương án thay thế.");
        }
        if (inquiry.getAlternativeAsset() == null) {
            throw new CustomException("Yêu cầu chưa có phương án thay thế.");
        }
        inquiry.setAlternativeAccepted(true);
        inquiry.setStatus(InquiryStatusSupport.IN_PROGRESS);
        inquiry.setUpdatedAt(UtcDateTimes.now());
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyTarget(saved, actor, "INQUIRY_ALTERNATIVE_ACCEPTED", "Nhân viên đã đồng ý phương án thay thế",
                displayName(actor) + " đã đồng ý phương án thay thế cho yêu cầu #" + inquiryId + ".");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse confirmReceipt(Long inquiryId) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        if (!isRequester(inquiry, actor)) {
            throw new AccessDeniedException("Bạn không có quyền xác nhận nhận thiết bị hoặc vật tư của yêu cầu này.");
        }
        if (!StringUtils.hasText(inquiry.getLinkedEntityType()) || inquiry.getLinkedEntityId() == null
                || !InquiryStatusSupport.WAITING_EMPLOYEE.equals(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu chưa ở bước chờ xác nhận đã nhận.");
        }
        if ("CONSUMABLE_REQUEST".equals(inquiry.getLinkedEntityType())) {
            ConsumableInquiryFulfillment fulfillment = consumableFulfillmentRepository.findByInquiryId(inquiryId)
                    .orElseThrow(() -> new CustomException("Không tìm thấy tiến độ cấp phát vật tư."));
            boolean fullyFulfilled = "FULFILLED".equals(fulfillment.getStatus());
            if (!fullyFulfilled && !Boolean.TRUE.equals(fulfillment.getClosedPartial())) {
                throw new CustomException("Vật tư chưa được ghi nhận cấp phát nên chưa thể xác nhận đã nhận.");
            }
        }
        LocalDateTime now = UtcDateTimes.now();
        inquiry.setStatus(InquiryStatusSupport.COMPLETED);
        inquiry.setReceivedAt(now);
        inquiry.setCompletedAt(now);
        inquiry.setUpdatedAt(now);
        inquiry.setDecisionNote("Nhân viên đã xác nhận nhận thiết bị hoặc vật tư.");
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        notifyTarget(saved, actor, "INQUIRY_RECEIPT_CONFIRMED", "Nhân viên đã xác nhận nhận hàng",
                displayName(actor) + " đã xác nhận nhận thiết bị hoặc vật tư của yêu cầu #" + inquiryId + ".");
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public InquiryResponse createConsumableRequest(Long inquiryId, InquiryConsumableConversionRequest request) {
        ServiceInquiry inquiry = inquiryRepository.findForUpdateById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
        AppUser actor = currentUserProvider.getCurrentUser();
        ensureAssignedHandler(inquiry, actor);
        if (!InquiryStatusSupport.CONSUMABLE_REQUEST.equals(inquiry.getInquiryType())) {
            throw new CustomException("Yêu cầu này không phải yêu cầu cấp phát vật tư.");
        }
        ensureNotConverted(inquiry);
        recordFirstResponse(inquiry, UtcDateTimes.now());
        Asset effectiveAsset = effectiveAsset(inquiry);
        int effectiveQuantity = effectiveQuantity(inquiry);
        int quantityRequestedInput = inquiry.getQuantityRequestedInput() != null
                ? inquiry.getQuantityRequestedInput()
                : inquiry.getQuantityRequested();
        String quantityRequestedUnit = StringUtils.hasText(inquiry.getQuantityRequestedUnit())
                ? inquiry.getQuantityRequestedUnit()
                : "RETAIL";
        ConsumableRequestResponse created = assetService.createConsumableRequestForRequester(
                inquiry.getDestinationLocation().getId(),
                ConsumableRequestCreateRequest.builder()
                        .assetQaCode(effectiveAsset.getQaCode())
                        .sourceWarehouseLocationId(request.getSourceWarehouseLocationId())
                        .quantityRequested(quantityRequestedInput)
                        .quantityRequestedUnit(quantityRequestedUnit)
                        .reason(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : inquiry.getPurpose())
                        .build(),
                inquiry.getRequester());
        Location sourceWarehouse = locationRepository.findById(created.getSourceWarehouseLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy kho xuất của phiếu cấp phát."));
        InquiryWorkflowSettingService.EffectiveSettings settings = workflowSettingService.getEffectiveSettings();
        BigDecimal purchasePrice = effectiveAsset.getPurchasePrice() == null
                ? BigDecimal.ZERO
                : effectiveAsset.getPurchasePrice();
        BigDecimal totalValue = purchasePrice.multiply(BigDecimal.valueOf(effectiveQuantity));
        boolean exceedsQuantityThreshold = effectiveQuantity >= settings.largeQuantityThreshold();
        boolean exceedsValueThreshold = settings.highValueThreshold().signum() > 0
                && totalValue.compareTo(settings.highValueThreshold()) >= 0;
        boolean requiresAdminApproval = exceedsQuantityThreshold || exceedsValueThreshold;
        LocalDateTime now = UtcDateTimes.now();
        inquiry.setLinkedEntityType("CONSUMABLE_REQUEST");
        inquiry.setLinkedEntityId(created.getId());
        inquiry.setStatus(requiresAdminApproval
                ? InquiryStatusSupport.WAITING_APPROVAL
                : InquiryStatusSupport.CONVERTED);
        inquiry.setUpdatedAt(now);
        ServiceInquiry saved = inquiryRepository.save(inquiry);
        consumableFulfillmentRepository.save(ConsumableInquiryFulfillment.builder()
                .inquiry(saved)
                .originalConsumableRequestId(created.getId())
                .activeConsumableRequestId(created.getId())
                .sourceWarehouseLocation(sourceWarehouse)
                .requestedQuantity(effectiveQuantity)
                .fulfilledQuantity(0)
                .status("PENDING")
                .requiresAdminApproval(requiresAdminApproval)
                .adminApproved(!requiresAdminApproval)
                .closedPartial(false)
                .createdAt(now)
                .updatedAt(now)
                .build());
        if (requiresAdminApproval) {
            notificationService.createNotification(
                    "CONSUMABLE_ADMIN_APPROVAL_REQUIRED",
                    "Yêu cầu cấp vật tư cần phê duyệt",
                    "Yêu cầu #" + saved.getId() + " vượt ngưỡng số lượng hoặc giá trị.",
                    actor.getUsername(),
                    effectiveAsset.getQaCode(),
                    effectiveAsset.getName(),
                    detailMap(saved),
                    List.of(NotificationTarget.forRole("Admin", "/admin/inquiries/" + saved.getId())));
            notifyRequester(saved, "INQUIRY_WAITING_APPROVAL", "Phiếu cấp phát đang chờ duyệt",
                    "Phiếu cấp phát #" + created.getId() + " cần Admin phê duyệt trước khi chuẩn bị.");
        } else {
            notifyRequester(saved, "INQUIRY_CONVERTED", "Đã tạo phiếu cấp phát",
                    "Phiếu cấp phát #" + created.getId() + " đã được tạo từ cuộc trao đổi.");
        }
        broadcastInquiryUpdate(saved);
        return mapInquiry(saved, actor);
    }

    @Transactional
    public void syncConsumableRequestStatus(Long requestId, String requestStatus, String decisionNote) {
        var managedFulfillment = consumableFulfillmentRepository
                .findForUpdateByActiveConsumableRequestId(requestId);
        if (managedFulfillment.isPresent()) {
            ConsumableInquiryFulfillment fulfillment = managedFulfillment.get();
            ServiceInquiry inquiry = fulfillment.getInquiry();
            LocalDateTime now = UtcDateTimes.now();
            if ("APPROVED".equalsIgnoreCase(requestStatus)) {
                fulfillment.setFulfilledQuantity(fulfillment.getRequestedQuantity());
                fulfillment.setPreparedQuantity(null);
                fulfillment.setStatus("FULFILLED");
                fulfillment.setFulfilledAt(now);
                fulfillment.setDecisionNote(StringUtils.hasText(decisionNote) ? decisionNote.trim() : null);
                inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
                inquiry.setDecisionNote("Đã cấp đủ vật tư, chờ nhân viên xác nhận đã nhận.");
            } else if ("REJECTED".equalsIgnoreCase(requestStatus)) {
                if (fulfillment.getFulfilledQuantity() != null && fulfillment.getFulfilledQuantity() > 0) {
                    fulfillment.setStatus("PARTIALLY_FULFILLED");
                    fulfillment.setClosedPartial(true);
                    fulfillment.setFulfilledAt(now);
                    inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
                    inquiry.setDecisionNote("Đã kết thúc phần còn lại của phiếu cấp phát.");
                } else {
                    fulfillment.setStatus("REJECTED");
                    inquiry.setStatus(InquiryStatusSupport.REJECTED);
                    inquiry.setCompletedAt(now);
                    inquiry.setDecisionNote(StringUtils.hasText(decisionNote) ? decisionNote.trim() : null);
                }
                fulfillment.setDecisionNote(StringUtils.hasText(decisionNote) ? decisionNote.trim() : null);
            } else {
                return;
            }
            fulfillment.setUpdatedAt(now);
            inquiry.setUpdatedAt(now);
            consumableFulfillmentRepository.save(fulfillment);
            inquiryRepository.save(inquiry);
            broadcastInquiryUpdate(inquiry);
            return;
        }
        inquiryRepository.findByLinkedEntityTypeAndLinkedEntityId("CONSUMABLE_REQUEST", requestId)
                .ifPresent(inquiry -> {
                    LocalDateTime now = UtcDateTimes.now();
                    if ("APPROVED".equalsIgnoreCase(requestStatus)) {
                        inquiry.setStatus(InquiryStatusSupport.WAITING_EMPLOYEE);
                        inquiry.setDecisionNote(StringUtils.hasText(decisionNote)
                                ? decisionNote.trim()
                                : "Vật tư đã được cấp phát, chờ nhân viên xác nhận đã nhận.");
                    } else if ("REJECTED".equalsIgnoreCase(requestStatus)) {
                        inquiry.setStatus(InquiryStatusSupport.REJECTED);
                        inquiry.setCompletedAt(now);
                        inquiry.setDecisionNote(StringUtils.hasText(decisionNote) ? decisionNote.trim() : null);
                    } else {
                        return;
                    }
                    inquiry.setUpdatedAt(now);
                    inquiryRepository.save(inquiry);
                    broadcastInquiryUpdate(inquiry);
                });
    }

    private InquiryMessage saveMessageEntity(
            ServiceInquiry inquiry,
            AppUser sender,
            String content,
            String mediaUrl,
            String mediaType,
            LocalDateTime createdAt) {
        return messageRepository.save(InquiryMessage.builder()
                .inquiry(inquiry)
                .sender(sender)
                .content(content)
                .mediaUrl(mediaUrl)
                .mediaType(mediaType)
                .createdAt(createdAt)
                .build());
    }

    private void markReadInternal(ServiceInquiry inquiry, AppUser actor) {
        boolean requester = isRequester(inquiry, actor);
        boolean responsibleHandler = inquiry.getTargetRole().equals(actor.getRole())
                && (inquiry.getAssignee() == null || actor.getId().equals(inquiry.getAssignee().getId()));
        if (!requester && !responsibleHandler) {
            return;
        }
        LocalDateTime now = UtcDateTimes.now();
        List<InquiryMessage> unread = messageRepository.findUnread(inquiry.getId(), actor.getId());
        unread.forEach(message -> message.setReadAt(now));
        if (!unread.isEmpty()) {
            messageRepository.saveAll(unread);
        }
    }

    private ServiceInquiry getDetail(Long inquiryId) {
        if (inquiryId == null) {
            throw new CustomException("ID yêu cầu là bắt buộc.");
        }
        return inquiryRepository.findDetailById(inquiryId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu."));
    }

    private void ensureCanView(ServiceInquiry inquiry, AppUser actor) {
        if (isRequester(inquiry, actor) || "Admin".equals(actor.getRole())
                || inquiry.getTargetRole().equals(actor.getRole())) {
            return;
        }
        throw new AccessDeniedException("Bạn không có quyền xem yêu cầu này.");
    }

    private void ensureCanMessage(ServiceInquiry inquiry, AppUser actor) {
        if (isRequester(inquiry, actor)) {
            return;
        }
        ensureAssignedHandler(inquiry, actor);
    }

    private void ensureTargetRole(ServiceInquiry inquiry, AppUser actor) {
        if (actor == null || !inquiry.getTargetRole().equals(actor.getRole())) {
            throw new AccessDeniedException("Bạn không thuộc nhóm xử lý yêu cầu này.");
        }
    }

    private void ensureAssignedHandler(ServiceInquiry inquiry, AppUser actor) {
        ensureTargetRole(inquiry, actor);
        if (inquiry.getAssignee() == null) {
            throw new CustomException("Vui lòng nhận xử lý yêu cầu trước.");
        }
        if (!actor.getId().equals(inquiry.getAssignee().getId())) {
            throw new AccessDeniedException("Yêu cầu đang được một người khác xử lý.");
        }
        if (InquiryStatusSupport.isTerminal(inquiry.getStatus())) {
            throw new CustomException("Yêu cầu đã kết thúc.");
        }
    }

    private boolean isRequester(ServiceInquiry inquiry, AppUser actor) {
        return inquiry != null && inquiry.getRequester() != null && actor != null
                && actor.getId().equals(inquiry.getRequester().getId());
    }

    private void ensureNotConverted(ServiceInquiry inquiry) {
        if (StringUtils.hasText(inquiry.getLinkedEntityType()) || inquiry.getLinkedEntityId() != null) {
            throw new CustomException("Yêu cầu đã được chuyển thành phiếu nghiệp vụ.");
        }
    }

    private void finishInquiry(ServiceInquiry inquiry, String status, String decisionNote) {
        LocalDateTime now = UtcDateTimes.now();
        inquiry.setStatus(status);
        inquiry.setDecisionNote(decisionNote);
        inquiry.setUpdatedAt(now);
        inquiry.setCompletedAt(now);
    }

    private void recordFirstResponse(ServiceInquiry inquiry, LocalDateTime respondedAt) {
        if (inquiry == null || inquiry.getFirstResponseAt() != null || respondedAt == null) {
            return;
        }
        inquiry.setFirstResponseAt(respondedAt);
        if (inquiry.getSlaResponseDueAt() != null && respondedAt.isAfter(inquiry.getSlaResponseDueAt())) {
            inquiry.setSlaBreachedAt(inquiry.getSlaResponseDueAt());
        }
    }

    private Asset effectiveAsset(ServiceInquiry inquiry) {
        return Boolean.TRUE.equals(inquiry.getAlternativeAccepted()) && inquiry.getAlternativeAsset() != null
                ? inquiry.getAlternativeAsset()
                : inquiry.getAsset();
    }

    private int effectiveQuantity(ServiceInquiry inquiry) {
        if (Boolean.TRUE.equals(inquiry.getAlternativeAccepted()) && inquiry.getProposedQuantity() != null) {
            return inquiry.getProposedQuantity();
        }
        return inquiry.getQuantityRequested();
    }

    private InquiryAvailabilityResponse mapAvailability(Asset asset) {
        boolean consumable = isConsumable(asset);
        String code;
        String label;
        boolean available;
        int quantity = consumable && asset.getQuantityOnHand() != null ? Math.max(0, asset.getQuantityOnHand()) : 1;
        if (consumable) {
            available = quantity > 0;
            code = available ? "AVAILABLE" : "OUT_OF_STOCK";
            label = available ? "Còn hàng" : "Hết hàng";
        } else if (isBrokenOrRepairing(asset)) {
            available = false;
            code = "REPAIRING";
            label = "Đang hỏng hoặc sửa chữa";
        } else if (isBorrowed(asset)) {
            available = false;
            code = "BORROWED";
            label = "Đang được mượn";
        } else if (borrowRequestRepository.existsByAssetQaCodeAndStatusIn(asset.getQaCode(), Set.of("APPROVED", "RESERVED"))) {
            available = false;
            code = "RESERVED";
            label = "Đã được giữ chỗ";
        } else {
            available = true;
            code = "AVAILABLE";
            label = "Có thể mượn";
        }
        return InquiryAvailabilityResponse.builder()
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .trackingMode(asset.getTrackingMode())
                .categoryId(asset.getCategory() != null ? asset.getCategory().getId() : null)
                .categoryName(asset.getCategory() != null ? asset.getCategory().getName() : null)
                .locationId(asset.getLocation() != null ? asset.getLocation().getId() : null)
                .locationName(asset.getLocation() != null ? asset.getLocation().getRoomName() : null)
                .homeLocationId(asset.getHomeLocation() != null ? asset.getHomeLocation().getId() : null)
                .homeLocationName(asset.getHomeLocation() != null ? asset.getHomeLocation().getRoomName() : null)
                .availabilityCode(code)
                .availabilityLabel(label)
                .available(available)
                .availableQuantity(consumable ? quantity : (available ? 1 : 0))
                .unit(asset.getUnit())
                .retailUnit(getAssetRetailUnit(asset))
                .wholesaleUnit(getAssetWholesaleUnit(asset))
                .wholesaleToRetailFactor(getAssetWholesaleFactor(asset))
                .formattedAvailableQuantity(consumable ? formatInquiryConsumableQuantity(asset, quantity) : (available ? "1 đơn vị" : "0 đơn vị"))
                .formattedAvailableQuantityRetailOnly(consumable ? formatInquiryConsumableQuantityRetailOnly(asset, quantity) : (available ? "1 đơn vị" : "0 đơn vị"))
                .build();
    }

    private InquiryResponse mapInquiry(ServiceInquiry inquiry, AppUser viewer) {
        Asset asset = inquiry.getAsset();
        Asset alternative = inquiry.getAlternativeAsset();
        Integer quantityRequestedInput = inquiry.getQuantityRequestedInput() != null
                ? inquiry.getQuantityRequestedInput()
                : inquiry.getQuantityRequested();
        String quantityRequestedUnit = StringUtils.hasText(inquiry.getQuantityRequestedUnit())
                ? inquiry.getQuantityRequestedUnit()
                : "RETAIL";
        return InquiryResponse.builder()
                .id(inquiry.getId())
                .inquiryType(inquiry.getInquiryType())
                .targetRole(inquiry.getTargetRole())
                .status(inquiry.getStatus())
                .requesterId(inquiry.getRequester().getId())
                .requesterName(displayName(inquiry.getRequester()))
                .assigneeId(inquiry.getAssignee() != null ? inquiry.getAssignee().getId() : null)
                .assigneeName(inquiry.getAssignee() != null ? displayName(inquiry.getAssignee()) : null)
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .trackingMode(asset.getTrackingMode())
                .assetStatus(asset.getStatus())
                .assetTechnicalStatus(asset.getTechnicalStatus())
                .assetUsageStatus(asset.getUsageStatus())
                .availableQuantity(isConsumable(asset) ? asset.getQuantityOnHand() : (Boolean.TRUE.equals(mapAvailability(asset).getAvailable()) ? 1 : 0))
                .unit(asset.getUnit())
                .retailUnit(getAssetRetailUnit(asset))
                .wholesaleUnit(getAssetWholesaleUnit(asset))
                .wholesaleToRetailFactor(getAssetWholesaleFactor(asset))
                .quantityRequested(inquiry.getQuantityRequested())
                .quantityRequestedInput(quantityRequestedInput)
                .quantityRequestedUnit(quantityRequestedUnit)
                .formattedQuantityRequested(isConsumable(asset) ? formatInquiryConsumableQuantity(asset, inquiry.getQuantityRequested()) : inquiry.getQuantityRequested() + " đơn vị")
                .formattedRequestedInputQuantity(isConsumable(asset)
                        ? formatInquiryConsumableRequestedInputQuantity(asset, quantityRequestedInput, quantityRequestedUnit)
                        : inquiry.getQuantityRequested() + " đơn vị")
                .formattedQuantityRequestedRetailOnly(isConsumable(asset)
                        ? formatInquiryConsumableQuantityRetailOnly(asset, inquiry.getQuantityRequested())
                        : inquiry.getQuantityRequested() + " đơn vị")
                .destinationLocationId(inquiry.getDestinationLocation().getId())
                .destinationLocationName(inquiry.getDestinationLocation().getRoomName())
                .neededFrom(inquiry.getNeededFrom())
                .expectedReturnDate(inquiry.getExpectedReturnDate())
                .purpose(inquiry.getPurpose())
                .alternativeAssetQaCode(alternative != null ? alternative.getQaCode() : null)
                .alternativeAssetName(alternative != null ? alternative.getName() : null)
                .proposedQuantity(inquiry.getProposedQuantity())
                .alternativeAccepted(inquiry.getAlternativeAccepted())
                .decisionNote(inquiry.getDecisionNote())
                .linkedEntityType(inquiry.getLinkedEntityType())
                .linkedEntityId(inquiry.getLinkedEntityId())
                .createdAt(toOffset(inquiry.getCreatedAt()))
                .updatedAt(toOffset(inquiry.getUpdatedAt()))
                .claimedAt(toOffset(inquiry.getClaimedAt()))
                .completedAt(toOffset(inquiry.getCompletedAt()))
                .receivedAt(toOffset(inquiry.getReceivedAt()))
                .slaResponseDueAt(toOffset(inquiry.getSlaResponseDueAt()))
                .firstResponseAt(toOffset(inquiry.getFirstResponseAt()))
                .slaBreachedAt(toOffset(inquiry.getSlaBreachedAt()))
                .overdueReminderCount(inquiry.getOverdueReminderCount() == null ? 0 : inquiry.getOverdueReminderCount())
                .unreadCount(viewer == null ? 0L : messageRepository.countUnread(inquiry.getId(), viewer.getId()))
                .build();
    }

    private String normalizeInquiryQuantityUnit(String quantityUnit) {
        if (!StringUtils.hasText(quantityUnit)) {
            return "RETAIL";
        }
        String normalized = quantityUnit.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("RETAIL", "WHOLESALE").contains(normalized)) {
            throw new CustomException("Đơn vị số lượng yêu cầu không hợp lệ.");
        }
        return normalized;
    }

    private int safeQuantity(Integer value) {
        return value == null || value < 0 ? 0 : value;
    }

    private String getAssetRetailUnit(Asset asset) {
        if (asset == null) return "đơn vị";
        String retailUnit = StringUtils.hasText(asset.getRetailUnit()) ? asset.getRetailUnit().trim() : null;
        if (StringUtils.hasText(retailUnit)) return retailUnit;
        return StringUtils.hasText(asset.getUnit()) ? asset.getUnit().trim() : "đơn vị";
    }

    private String getAssetWholesaleUnit(Asset asset) {
        if (asset == null) return "đơn vị";
        String wholesaleUnit = StringUtils.hasText(asset.getWholesaleUnit()) ? asset.getWholesaleUnit().trim() : null;
        if (StringUtils.hasText(wholesaleUnit)) return wholesaleUnit;
        return getAssetRetailUnit(asset);
    }

    private int getAssetWholesaleFactor(Asset asset) {
        if (asset == null || asset.getWholesaleToRetailFactor() == null || asset.getWholesaleToRetailFactor() <= 0) {
            return 1;
        }
        return asset.getWholesaleToRetailFactor();
    }

    private String formatInquiryConsumableQuantity(Asset asset, Integer quantity) {
        int safeQuantity = safeQuantity(quantity);
        String retailUnit = getAssetRetailUnit(asset);
        String wholesaleUnit = getAssetWholesaleUnit(asset);
        int factor = getAssetWholesaleFactor(asset);
        if (factor <= 1) {
            return safeQuantity + " " + retailUnit;
        }
        int wholesaleQuantity = safeQuantity / factor;
        int retailQuantity = safeQuantity % factor;
        if (wholesaleQuantity > 0 && retailQuantity > 0) {
            return wholesaleQuantity + " " + wholesaleUnit + " + " + retailQuantity + " " + retailUnit;
        }
        if (wholesaleQuantity > 0) {
            return wholesaleQuantity + " " + wholesaleUnit;
        }
        return retailQuantity + " " + retailUnit;
    }

    private String formatInquiryConsumableQuantityRetailOnly(Asset asset, Integer quantity) {
        return safeQuantity(quantity) + " " + getAssetRetailUnit(asset);
    }

    private String formatInquiryConsumableRequestedInputQuantity(Asset asset, Integer quantity, String quantityUnit) {
        String normalizedUnit = normalizeInquiryQuantityUnit(quantityUnit);
        String unitLabel = "WHOLESALE".equals(normalizedUnit) ? getAssetWholesaleUnit(asset) : getAssetRetailUnit(asset);
        return safeQuantity(quantity) + " " + unitLabel;
    }

    private InquiryMessageResponse mapMessage(InquiryMessage message) {
        return InquiryMessageResponse.builder()
                .id(message.getId())
                .inquiryId(message.getInquiry().getId())
                .senderId(message.getSender().getId())
                .senderName(displayName(message.getSender()))
                .senderRole(message.getSender().getRole())
                .content(message.getContent())
                .mediaUrl(message.getMediaUrl())
                .mediaType(message.getMediaType())
                .createdAt(toOffset(message.getCreatedAt()))
                .readAt(toOffset(message.getReadAt()))
                .build();
    }

    private void notifyCreated(ServiceInquiry inquiry) {
        notificationService.createNotification(
                "INQUIRY_CREATED",
                inquiry.getInquiryType().equals(InquiryStatusSupport.ASSET_BORROW)
                        ? "Có yêu cầu mượn thiết bị mới"
                        : "Có yêu cầu cấp phát vật tư mới",
                displayName(inquiry.getRequester()) + " đã tạo yêu cầu #" + inquiry.getId() + ".",
                inquiry.getRequester().getUsername(),
                inquiry.getAsset().getQaCode(),
                inquiry.getAsset().getName(),
                detailMap(inquiry),
                List.of(NotificationTarget.forRole(inquiry.getTargetRole(), roleDetailPath(inquiry))));
        broadcastInquiryUpdate(inquiry);
    }

    private void notifyMessage(ServiceInquiry inquiry, AppUser sender, String preview) {
        String safePreview = preview.length() > 160 ? preview.substring(0, 160) + "..." : preview;
        if (isRequester(inquiry, sender)) {
            notifyTarget(inquiry, sender, "INQUIRY_MESSAGE", "Có tin nhắn yêu cầu mới", safePreview);
        } else {
            notifyRequester(inquiry, "INQUIRY_MESSAGE", "Có phản hồi cho yêu cầu #" + inquiry.getId(), safePreview);
        }
    }

    private void notifyRequester(ServiceInquiry inquiry, String eventType, String title, String message) {
        notificationService.createNotification(
                eventType,
                title,
                message,
                inquiry.getAssignee() != null ? inquiry.getAssignee().getUsername() : "system",
                inquiry.getAsset().getQaCode(),
                inquiry.getAsset().getName(),
                detailMap(inquiry),
                List.of(NotificationTarget.forUser(inquiry.getRequester().getId(), employeeDetailPath(inquiry))));
    }

    private void notifyTarget(ServiceInquiry inquiry, AppUser actor, String eventType, String title, String message) {
        NotificationTarget target = inquiry.getAssignee() != null
                ? NotificationTarget.forUser(inquiry.getAssignee().getId(), roleDetailPath(inquiry))
                : NotificationTarget.forRole(inquiry.getTargetRole(), roleDetailPath(inquiry));
        notificationService.createNotification(
                eventType,
                title,
                message,
                actor.getUsername(),
                inquiry.getAsset().getQaCode(),
                inquiry.getAsset().getName(),
                detailMap(inquiry),
                List.of(target));
    }

    private Map<String, Object> detailMap(ServiceInquiry inquiry) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("Yêu cầu", "#" + inquiry.getId());
        detail.put("Thiết bị/Vật tư", inquiry.getAsset().getQaCode() + " - " + inquiry.getAsset().getName());
        detail.put("Người yêu cầu", displayName(inquiry.getRequester()));
        detail.put("Trạng thái", inquiry.getStatus());
        return detail;
    }

    private void broadcastMessage(ServiceInquiry inquiry, InquiryMessageResponse message, AppUser sender) {
        for (Integer userId : participantUserIds(inquiry)) {
            if (!userId.equals(sender.getId())) {
                realtimePushService.pushToDestination("/topic/users/" + userId + "/inquiries/" + inquiry.getId(), message);
            }
        }
    }

    private void broadcastInquiryUpdate(ServiceInquiry inquiry) {
        for (Integer userId : participantUserIds(inquiry)) {
            realtimePushService.pushToDestination("/topic/users/" + userId + "/inquiry-updates", Map.of(
                    "inquiryId", inquiry.getId(),
                    "status", inquiry.getStatus(),
                    "updatedAt", toOffset(inquiry.getUpdatedAt())));
        }
    }

    private List<Integer> participantUserIds(ServiceInquiry inquiry) {
        List<Integer> ids = new ArrayList<>();
        ids.add(inquiry.getRequester().getId());
        if (inquiry.getAssignee() != null) {
            ids.add(inquiry.getAssignee().getId());
        } else {
            appUserRepository.findByRole(inquiry.getTargetRole()).stream()
                    .filter(user -> "Hoạt động".equals(user.getStatus()))
                    .map(AppUser::getId)
                    .forEach(ids::add);
        }
        return ids.stream().distinct().toList();
    }

    private String employeeDetailPath(ServiceInquiry inquiry) {
        return "/mobile/inquiries/" + inquiry.getId();
    }

    private String roleDetailPath(ServiceInquiry inquiry) {
        return "ConsumableManager".equals(inquiry.getTargetRole())
                ? "/supply/inquiries/" + inquiry.getId()
                : "/admin/inquiries/" + inquiry.getId();
    }

    private boolean isConsumable(Asset asset) {
        return asset != null && "CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode());
    }

    private boolean isBrokenOrRepairing(Asset asset) {
        String status = value(asset.getStatus());
        String technicalStatus = value(asset.getTechnicalStatus());
        return List.of("Hỏng", "Bảo trì", "Thất lạc").contains(status)
                || List.of("Hỏng", "Thất lạc").contains(technicalStatus);
    }

    private boolean isBorrowed(Asset asset) {
        if ("Đang cho mượn".equals(value(asset.getUsageStatus())) || "Đang sử dụng".equals(value(asset.getStatus()))) {
            return true;
        }
        return asset.getHomeLocation() != null && asset.getLocation() != null
                && !asset.getHomeLocation().getId().equals(asset.getLocation().getId());
    }

    private String normalizeTrackingMode(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ITEMIZED", "CONSUMABLE").contains(normalized)) {
            throw new CustomException("Loại tài sản cần tra cứu không hợp lệ.");
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!InquiryStatusSupport.INBOX_STATUSES.contains(normalized)) {
            throw new CustomException("Trạng thái yêu cầu không hợp lệ.");
        }
        return normalized;
    }

    private String normalizeAssetQaCode(String value) {
        if (!StringUtils.hasText(value)) {
            throw new CustomException("Mã thiết bị hoặc vật tư là bắt buộc.");
        }
        return value.trim();
    }

    private int safePositive(Integer value, int fallback) {
        return value != null && value > 0 ? value : fallback;
    }

    private String displayName(AppUser user) {
        if (user == null) {
            return "Hệ thống";
        }
        return StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private String note(InquiryActionRequest request) {
        return request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
    }

    private String value(String value) {
        return value == null ? "" : value.trim();
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(STORAGE_OFFSET);
    }
}
