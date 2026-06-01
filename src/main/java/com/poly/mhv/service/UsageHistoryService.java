package com.poly.mhv.service;

import com.poly.mhv.dto.usage.CheckinRequest;
import com.poly.mhv.dto.usage.CheckoutRequest;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.dto.usage.UsageHistoryAdminResponse;
import com.poly.mhv.dto.usage.UsageHistoryResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.UsageHistory;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.util.AssetStatusSupport;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UsageHistoryService {

    private final UsageHistoryRepository usageHistoryRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final LocationRepository locationRepository;
    private final NotificationService notificationService;

    public UsageHistoryService(
            UsageHistoryRepository usageHistoryRepository,
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            LocationRepository locationRepository,
            NotificationService notificationService
    ) {
        this.usageHistoryRepository = usageHistoryRepository;
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.locationRepository = locationRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public UsageHistoryResponse checkout(CheckoutRequest request) {
        validateCheckoutRequest(request);

        Asset asset = assetRepository.findById(request.getAssetQaCode())
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        validateAssetForCheckout(asset);

        usageHistoryRepository.findByAssetQaCodeAndEndTimeIsNull(request.getAssetQaCode())
                .ifPresent(history -> {
                    throw new CustomException("Thiết bị này đang được mượn rồi, vui lòng chọn thiết bị khác.");
                });

        AppUser user = appUserRepository.findById(request.getUserId())
                .orElseThrow(() -> new CustomException("Không tìm thấy người dùng với id: " + request.getUserId()));
        Location toLocation = locationRepository.findById(request.getToLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng đích với id: " + request.getToLocationId()));
        if (toLocation.getHasAsset() != null && !toLocation.getHasAsset()) {
            throw new CustomException("Không thể chuyển tài sản đến khu vực không chứa tài sản.");
        }

        Location fromLocation = asset.getLocation();
        if (fromLocation.getId().equals(toLocation.getId())) {
            throw new CustomException("Phòng đích không được trùng với phòng hiện tại của thiết bị.");
        }
        LocalDateTime startTime = LocalDateTime.now();
        usageHistoryRepository.insertOpenUsageHistory(
                asset.getQaCode(),
                user.getId(),
                startTime,
                fromLocation.getId(),
                toLocation.getId()
        );
        UsageHistory saved = usageHistoryRepository.findByAssetQaCodeAndEndTimeIsNull(asset.getQaCode())
                .orElseThrow(() -> new CustomException("Không tạo được phiên mượn thiết bị."));
        asset.setUsageStatus(AssetStatusSupport.USAGE_STATUS_BORROWED);
        asset.setStatus(AssetStatusSupport.deriveLegacyStatus(
                resolveTechnicalStatus(asset),
                asset.getUsageStatus(),
                false
        ));
        asset.setLocation(toLocation);
        assetRepository.save(asset);
        String actorDisplayName = getActorDisplayName(user);
        notificationService.createNotification(
                "CHECKOUT",
                "Mượn thiết bị",
                actorDisplayName + " đã mượn " + asset.getName()
                        + " từ phòng gốc " + asset.getHomeLocation().getRoomName()
                        + " đến phòng " + toLocation.getRoomName() + ".",
                user.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Nghiệp vụ", "Mượn thiết bị",
                        "Thời gian", saved.getStartTime(),
                        "Người thực hiện", actorDisplayName,
                        "Phòng gốc", asset.getHomeLocation().getRoomName(),
                        "Phòng hiện tại trước khi mượn", fromLocation.getRoomName(),
                        "Phòng đích", toLocation.getRoomName()
                )
        );
        return mapToResponse(saved);
    }

    @Transactional
    public UsageHistoryResponse checkin(CheckinRequest request) {
        if (request == null || !StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("assetQaCode là bắt buộc.");
        }

        Asset asset = assetRepository.findById(request.getAssetQaCode())
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));

        UsageHistory usageHistory = usageHistoryRepository.findByAssetQaCodeAndEndTimeIsNull(request.getAssetQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy phiên mượn đang mở của thiết bị: " + request.getAssetQaCode()));
        AppUser actor = getCurrentUser();
        if (!usageHistory.getUser().getId().equals(actor.getId())) {
            throw new CustomException("Bạn không phải người đã mượn thiết bị này, nên không thể thực hiện trả.");
        }

        usageHistory.setEndTime(LocalDateTime.now());
        asset.setUsageStatus(AssetStatusSupport.USAGE_STATUS_HOME);
        asset.setStatus(AssetStatusSupport.deriveLegacyStatus(
                resolveTechnicalStatus(asset),
                asset.getUsageStatus(),
                false
        ));
        asset.setLocation(asset.getHomeLocation());

        assetRepository.save(asset);
        UsageHistory saved = usageHistoryRepository.save(usageHistory);
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CHECKIN",
                "Trả thiết bị",
                actorDisplayName + " đã trả " + asset.getName()
                        + " từ phòng " + usageHistory.getToLocation().getRoomName()
                        + " về phòng gốc " + asset.getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Nghiệp vụ", "Trả thiết bị",
                        "Thời gian", saved.getEndTime(),
                        "Người thực hiện", actorDisplayName,
                        "Phòng gốc", asset.getHomeLocation().getRoomName(),
                        "Phòng đang mượn", usageHistory.getToLocation().getRoomName(),
                        "Điểm trả", asset.getHomeLocation().getRoomName()
                )
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<UsageHistoryAdminResponse> getMyHistory() {
        AppUser actor = getCurrentUser();
        return usageHistoryRepository.findByUserIdForHistory(actor.getId()).stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponse<UsageHistoryAdminResponse> searchForAdmin(
            int page,
            int size,
            String assetName,
            Integer borrowedLocationId,
            Integer userId,
            LocalDate startDate,
            LocalDate endDate,
            String sortKey,
            String sortDirection
    ) {
        String normalizedAssetName = StringUtils.hasText(assetName) ? assetName.trim() : null;
        LocalDateTime startDateTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate == null ? null : endDate.plusDays(1).atStartOfDay().minusNanos(1);
        PageRequest pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(size, 100)),
                buildSort(sortKey, sortDirection)
        );
        Page<UsageHistory> historyPage = usageHistoryRepository.searchForAdminDynamic(
                normalizedAssetName,
                borrowedLocationId,
                userId,
                startDateTime,
                endDateTime,
                pageable
        );
        return new PagedResponse<>(
                historyPage.getContent().stream()
                        .map(this::mapToAdminResponse)
                        .toList(),
                historyPage.getNumber(),
                historyPage.getSize(),
                Math.max(1, historyPage.getTotalPages()),
                historyPage.getTotalElements()
        );
    }

    private void validateCheckoutRequest(CheckoutRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu check-out không được để trống.");
        }
        if (!StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("assetQaCode là bắt buộc.");
        }
        if (request.getUserId() == null) {
            throw new CustomException("userId là bắt buộc.");
        }
        if (request.getToLocationId() == null) {
            throw new CustomException("toLocationId là bắt buộc.");
        }
    }

    private void validateAssetForCheckout(Asset asset) {
        if ("CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode())) {
            throw new CustomException("Vật tư tiêu hao không hỗ trợ mượn/trả.");
        }
        String technicalStatus = resolveTechnicalStatus(asset);
        String usageStatus = resolveUsageStatus(asset);
        if (AssetStatusSupport.TECHNICAL_STATUS_GOOD.equals(technicalStatus)
                && AssetStatusSupport.USAGE_STATUS_HOME.equals(usageStatus)) {
            return;
        }
        if (AssetStatusSupport.TECHNICAL_STATUS_BROKEN.equals(technicalStatus)
                && AssetStatusSupport.isRepairInProgress(asset.getStatus())) {
            throw new CustomException("Thiết bị đang Đang sửa chữa, không thể mượn.");
        }
        if (AssetStatusSupport.TECHNICAL_STATUS_BROKEN.equals(technicalStatus)) {
            throw new CustomException("Thiết bị đang ở trạng thái Hỏng, không thể mượn.");
        }
        if (AssetStatusSupport.TECHNICAL_STATUS_LOST.equals(technicalStatus)) {
            throw new CustomException("Thiết bị đang ở trạng thái Thất lạc, không thể mượn.");
        }
        if (AssetStatusSupport.USAGE_STATUS_BORROWED.equals(usageStatus)) {
            throw new CustomException("Thiết bị đang Đang cho mượn, không thể mượn.");
        }
        throw new CustomException("Thiết bị không ở trạng thái Hoạt động tốt.");
    }

    private String resolveTechnicalStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.TECHNICAL_STATUS_GOOD;
        }
        return AssetStatusSupport.resolveTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
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

    private UsageHistoryResponse mapToResponse(UsageHistory usageHistory) {
        Asset asset = usageHistory.getAsset();
        String technicalStatus = resolveTechnicalStatus(asset);
        String usageStatus = resolveUsageStatus(asset);
        return UsageHistoryResponse.builder()
                .id(usageHistory.getId())
                .assetQaCode(usageHistory.getAsset().getQaCode())
                .userId(usageHistory.getUser().getId())
                .fromLocationId(usageHistory.getFromLocation().getId())
                .toLocationId(usageHistory.getToLocation().getId())
                .assetTechnicalStatus(technicalStatus)
                .assetUsageStatus(usageStatus)
                .assetDisplayStatus(AssetStatusSupport.deriveDisplayStatus(
                        technicalStatus,
                        usageStatus,
                        AssetStatusSupport.isRepairInProgress(asset.getStatus())
                ))
                .startTime(usageHistory.getStartTime())
                .endTime(usageHistory.getEndTime())
                .build();
    }

    private UsageHistoryAdminResponse mapToAdminResponse(UsageHistory usageHistory) {
        Asset asset = usageHistory.getAsset();
        String technicalStatus = resolveTechnicalStatus(asset);
        return UsageHistoryAdminResponse.builder()
                .id(usageHistory.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .homeLocationName(asset.getHomeLocation().getRoomName())
                .assetTechnicalStatus(technicalStatus)
                .startTime(usageHistory.getStartTime())
                .borrowedLocationName(usageHistory.getToLocation().getRoomName())
                .endTime(usageHistory.getEndTime())
                .borrowerFullName(getFullNameOrUsername(usageHistory.getUser()))
                .build();
    }

    private Sort buildSort(String sortKey, String sortDirection) {
        String normalizedSortKey = StringUtils.hasText(sortKey) ? sortKey.trim() : "startTime";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return switch (normalizedSortKey) {
            case "assetQaCode" -> Sort.by(direction, "asset.qaCode").and(Sort.by(Sort.Direction.DESC, "id"));
            case "assetName" -> Sort.by(direction, "asset.name").and(Sort.by(Sort.Direction.DESC, "id"));
            case "homeLocationName" -> Sort.by(direction, "asset.homeLocation.roomName").and(Sort.by(Sort.Direction.DESC, "id"));
            case "borrowedLocationName" -> Sort.by(direction, "toLocation.roomName").and(Sort.by(Sort.Direction.DESC, "id"));
            case "endTime" -> Sort.by(direction, "endTime").and(Sort.by(Sort.Direction.DESC, "id"));
            case "borrowerFullName", "username" -> Sort.by(direction, "user.fullName").and(Sort.by(Sort.Direction.DESC, "id"));
            default -> Sort.by(direction, "startTime").and(Sort.by(Sort.Direction.DESC, "id"));
        };
    }

    private AppUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new CustomException("Không xác định được người dùng đăng nhập.");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            return appUserRepository.findById(userDetails.getId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy người dùng đăng nhập."));
        }
        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new CustomException("Không tìm thấy người dùng đăng nhập."));
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
}
