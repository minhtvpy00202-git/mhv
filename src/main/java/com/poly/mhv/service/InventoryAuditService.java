package com.poly.mhv.service;

import com.poly.mhv.dto.inventory.InventoryAuditCreateRequest;
import com.poly.mhv.dto.inventory.InventoryAuditDetailResponse;
import com.poly.mhv.dto.inventory.InventoryAuditItemResponse;
import com.poly.mhv.dto.inventory.InventoryAuditMissingResponse;
import com.poly.mhv.dto.inventory.InventoryAuditScanRequest;
import com.poly.mhv.dto.inventory.InventoryAuditScanResultResponse;
import com.poly.mhv.dto.inventory.InventoryAuditSummaryResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.InventoryAudit;
import com.poly.mhv.entity.InventoryAuditItem;
import com.poly.mhv.entity.InventoryAuditMissing;
import com.poly.mhv.entity.Location;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.InventoryAuditItemRepository;
import com.poly.mhv.repository.InventoryAuditMissingRepository;
import com.poly.mhv.repository.InventoryAuditRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class InventoryAuditService {

    private final InventoryAuditRepository inventoryAuditRepository;
    private final InventoryAuditItemRepository inventoryAuditItemRepository;
    private final InventoryAuditMissingRepository inventoryAuditMissingRepository;
    private final AssetRepository assetRepository;
    private final LocationRepository locationRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;

    public InventoryAuditService(
            InventoryAuditRepository inventoryAuditRepository,
            InventoryAuditItemRepository inventoryAuditItemRepository,
            InventoryAuditMissingRepository inventoryAuditMissingRepository,
            AssetRepository assetRepository,
            LocationRepository locationRepository,
            AppUserRepository appUserRepository,
            NotificationService notificationService
    ) {
        this.inventoryAuditRepository = inventoryAuditRepository;
        this.inventoryAuditItemRepository = inventoryAuditItemRepository;
        this.inventoryAuditMissingRepository = inventoryAuditMissingRepository;
        this.assetRepository = assetRepository;
        this.locationRepository = locationRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public InventoryAuditSummaryResponse createAudit(InventoryAuditCreateRequest request) {
        if (request == null || request.getLocationId() == null) {
            throw new CustomException("locationId là bắt buộc.");
        }
        if (inventoryAuditRepository.existsByLocationIdAndStatus(request.getLocationId(), "OPEN")) {
            throw new CustomException("Phòng này đã có phiên kiểm kê đang mở.");
        }
        Location location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
        AppUser actor = getCurrentUser();
        InventoryAudit audit = InventoryAudit.builder()
                .location(location)
                .createdBy(actor)
                .startedAt(LocalDateTime.now())
                .status("OPEN")
                .notes(StringUtils.hasText(request.getNotes()) ? request.getNotes().trim() : null)
                .expectedCount(0)
                .scannedCount(0)
                .missingCount(0)
                .build();
        InventoryAudit saved = inventoryAuditRepository.save(audit);
        return mapSummary(saved);
    }

    @Transactional(readOnly = true)
    public List<InventoryAuditSummaryResponse> getAudits(String status) {
        String normalizedStatus = StringUtils.hasText(status) ? status.trim().toUpperCase() : null;
        return inventoryAuditRepository.findForAdmin(normalizedStatus).stream()
                .map(this::mapSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryAuditSummaryResponse> getActiveAudits() {
        return getAudits("OPEN");
    }

    @Transactional(readOnly = true)
    public List<InventoryAuditSummaryResponse> getMyAudits() {
        AppUser actor = getCurrentUser();
        return inventoryAuditRepository.findByCreatedByIdForHistory(actor.getId()).stream()
                .map(this::mapSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryAuditDetailResponse getDetail(Integer auditId) {
        InventoryAudit audit = inventoryAuditRepository.findDetailById(auditId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiên kiểm kê."));
        List<InventoryAuditItemResponse> scannedItems = inventoryAuditItemRepository.findByAuditIdOrderByScannedAtDesc(auditId).stream()
                .map(item -> {
                    Asset scannedAsset = assetRepository.findById(item.getAssetQaCode()).orElse(null);
                    return InventoryAuditItemResponse.builder()
                            .assetQaCode(item.getAssetQaCode())
                            .assetName(item.getAssetName())
                            .currentLocationName(scannedAsset != null ? scannedAsset.getLocation().getRoomName() : null)
                            .homeLocationName(scannedAsset != null ? scannedAsset.getHomeLocation().getRoomName() : null)
                            .scannedByUsername(item.getScannedByUsername())
                            .scannedAt(item.getScannedAt())
                            .build();
                })
                .toList();
        List<InventoryAuditMissingResponse> missingItems = inventoryAuditMissingRepository.findByAuditIdOrderByAssetQaCodeAsc(auditId).stream()
                .map(missing -> InventoryAuditMissingResponse.builder()
                        .assetQaCode(missing.getAssetQaCode())
                        .assetName(missing.getAssetName())
                        .locationName(missing.getLocationName())
                        .resolutionStatus(missing.getResolutionStatus())
                        .resolvedAt(missing.getResolvedAt())
                        .resolvedByUsername(missing.getResolvedByUsername())
                        .build())
                .toList();
        return InventoryAuditDetailResponse.builder()
                .summary(mapSummary(audit))
                .scannedItems(scannedItems)
                .missingItems(missingItems)
                .build();
    }

    @Transactional
    public InventoryAuditScanResultResponse scanAsset(Integer auditId, InventoryAuditScanRequest request) {
        if (request == null || !StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("assetQaCode là bắt buộc.");
        }
        InventoryAudit audit = inventoryAuditRepository.findDetailById(auditId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiên kiểm kê."));
        if (!"OPEN".equals(audit.getStatus())) {
            throw new CustomException("Phiên kiểm kê đã đóng.");
        }
        String qaCode = request.getAssetQaCode().trim();
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        if (!asset.getHomeLocation().getId().equals(audit.getLocation().getId())) {
            throw new CustomException("Tài sản này thuộc " + asset.getHomeLocation().getRoomName());
        }
        if (inventoryAuditItemRepository.existsByAuditIdAndAssetQaCode(auditId, qaCode)) {
            throw new CustomException("Thiết bị " + qaCode + " đã được quét trong phiên này.");
        }

        AppUser actor = getCurrentUser();
        InventoryAuditItem item = InventoryAuditItem.builder()
                .audit(audit)
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .scannedAt(LocalDateTime.now())
                .scannedByUsername(actor.getUsername())
                .build();
        inventoryAuditItemRepository.save(item);

        int scannedCount = (int) inventoryAuditItemRepository.countByAuditId(auditId);
        int expectedCount = assetRepository.findByHomeLocationId(audit.getLocation().getId()).size();
        audit.setScannedCount(scannedCount);
        audit.setExpectedCount(expectedCount);
        inventoryAuditRepository.save(audit);

        return InventoryAuditScanResultResponse.builder()
                .auditId(auditId)
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .currentLocationName(asset.getLocation().getRoomName())
                .homeLocationName(asset.getHomeLocation().getRoomName())
                .scannedCount(scannedCount)
                .expectedCount(expectedCount)
                .build();
    }

    @Transactional
    public InventoryAuditDetailResponse completeAudit(Integer auditId) {
        InventoryAudit audit = inventoryAuditRepository.findDetailById(auditId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiên kiểm kê."));
        if (!"OPEN".equals(audit.getStatus())) {
            throw new CustomException("Phiên kiểm kê đã được hoàn thành.");
        }
        List<Asset> expectedAssets = assetRepository.findByHomeLocationId(audit.getLocation().getId());
        java.util.Set<String> scannedQaCodes = inventoryAuditItemRepository.findQaCodesByAuditId(auditId).stream()
                .collect(java.util.stream.Collectors.toSet());

        inventoryAuditMissingRepository.deleteByAuditId(auditId);
        int missingCount = 0;
        for (Asset asset : expectedAssets) {
            if (!scannedQaCodes.contains(asset.getQaCode())) {
                InventoryAuditMissing missing = InventoryAuditMissing.builder()
                        .audit(audit)
                        .assetQaCode(asset.getQaCode())
                        .assetName(asset.getName())
                        .locationName(asset.getHomeLocation().getRoomName())
                        .resolutionStatus("PENDING")
                        .build();
                inventoryAuditMissingRepository.save(missing);
                asset.setStatus("Thất lạc");
                assetRepository.save(asset);
                missingCount++;
            }
        }

        audit.setExpectedCount(expectedAssets.size());
        audit.setScannedCount(scannedQaCodes.size());
        audit.setMissingCount(missingCount);
        audit.setCompletedAt(LocalDateTime.now());
        audit.setStatus("COMPLETED");
        inventoryAuditRepository.save(audit);

        AppUser actor = getCurrentUser();
        notificationService.createNotification(
                "INVENTORY_AUDIT_COMPLETED",
                "Hoàn thành kiểm kê",
                "Phiên kiểm kê phòng " + audit.getLocation().getRoomName() + " đã hoàn tất, thất lạc: " + missingCount + " thiết bị.",
                actor.getUsername(),
                null,
                "Phiên kiểm kê phòng " + audit.getLocation().getRoomName(),
                java.util.Map.of(
                        "Nghiệp vụ", "Hoàn thành kiểm kê",
                        "Phòng", audit.getLocation().getRoomName(),
                        "Số lượng dự kiến", audit.getExpectedCount(),
                        "Số lượng đã quét", audit.getScannedCount(),
                        "Số lượng thất lạc", missingCount,
                        "Người thực hiện", actor.getUsername()
                )
        );

        return getDetail(auditId);
    }

    @Transactional
    public InventoryAuditDetailResponse resolveMissingFound(Integer auditId, String assetQaCode) {
        InventoryAuditMissing missing = inventoryAuditMissingRepository.findByAuditIdAndAssetQaCode(auditId, assetQaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị thất lạc trong phiên kiểm kê."));
        AppUser actor = getCurrentUser();
        missing.setResolutionStatus("FOUND");
        missing.setResolvedAt(LocalDateTime.now());
        missing.setResolvedByUsername(actor.getUsername());
        inventoryAuditMissingRepository.save(missing);

        assetRepository.findById(assetQaCode).ifPresent(asset -> {
            asset.setStatus("Sẵn sàng");
            assetRepository.save(asset);
        });

        return getDetail(auditId);
    }

    @Transactional
    public InventoryAuditDetailResponse resolveMissingLost(Integer auditId, String assetQaCode) {
        InventoryAuditMissing missing = inventoryAuditMissingRepository.findByAuditIdAndAssetQaCode(auditId, assetQaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị thất lạc trong phiên kiểm kê."));
        AppUser actor = getCurrentUser();
        missing.setResolutionStatus("LOST");
        missing.setResolvedAt(LocalDateTime.now());
        missing.setResolvedByUsername(actor.getUsername());
        inventoryAuditMissingRepository.save(missing);

        assetRepository.findById(assetQaCode).ifPresent(assetRepository::delete);
        return getDetail(auditId);
    }

    private InventoryAuditSummaryResponse mapSummary(InventoryAudit audit) {
        return InventoryAuditSummaryResponse.builder()
                .id(audit.getId())
                .locationId(audit.getLocation().getId())
                .locationName(audit.getLocation().getRoomName())
                .createdByUsername(audit.getCreatedBy().getUsername())
                .startedAt(audit.getStartedAt())
                .completedAt(audit.getCompletedAt())
                .status(audit.getStatus())
                .expectedCount(audit.getExpectedCount())
                .scannedCount(audit.getScannedCount())
                .missingCount(audit.getMissingCount())
                .notes(audit.getNotes())
                .build();
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
}
