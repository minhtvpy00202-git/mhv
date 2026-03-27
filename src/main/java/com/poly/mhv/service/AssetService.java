package com.poly.mhv.service;

import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.util.QRCodeGenerator;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AssetService {

    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final CategoryRepository categoryRepository;
    private final LocationRepository locationRepository;
    private final QRCodeGenerator qrCodeGenerator;
    private final NotificationService notificationService;

    public AssetService(
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            CategoryRepository categoryRepository,
            LocationRepository locationRepository,
            QRCodeGenerator qrCodeGenerator,
            NotificationService notificationService
    ) {
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.categoryRepository = categoryRepository;
        this.locationRepository = locationRepository;
        this.qrCodeGenerator = qrCodeGenerator;
        this.notificationService = notificationService;
    }

    @Transactional
    public AssetResponse createAsset(AssetCreateRequest request) {
        validateCreateRequest(request);
        if (assetRepository.existsById(request.getQaCode())) {
            throw new CustomException("Mã thiết bị đã tồn tại: " + request.getQaCode());
        }

        Location location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));

        String status = StringUtils.hasText(request.getStatus()) ? request.getStatus() : "Sẵn sàng";
        Asset asset = Asset.builder()
                .qaCode(request.getQaCode())
                .name(request.getName())
                .category(category)
                .legacyCategoryName(category.getName())
                .status(status)
                .location(location)
                .homeLocation(location)
                .build();
        Asset saved = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        notificationService.createNotification(
                "ASSET_CREATE",
                "Thêm mới thiết bị",
                "Thiết bị " + saved.getQaCode() + " đã được thêm mới.",
                actor.getUsername(),
                saved.getQaCode(),
                saved.getName(),
                Map.of(
                        "Thiết bị", saved.getQaCode() + " - " + saved.getName(),
                        "Loại", saved.getCategory().getName(),
                        "Phòng gốc", saved.getHomeLocation().getRoomName(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actor.getUsername()
                )
        );
        return mapToAssetResponse(saved, true);
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> getAllAssets() {
        return assetRepository.searchForAdmin(null, null, null).stream()
                .map(asset -> mapToAssetResponse(asset, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> searchAssets(String name, String status, Integer categoryId) {
        String normalizedName = StringUtils.hasText(name) ? name.trim() : null;
        String normalizedStatus = StringUtils.hasText(status) ? status.trim() : null;
        return assetRepository.searchForAdmin(normalizedName, normalizedStatus, categoryId).stream()
                .map(asset -> mapToAssetResponse(asset, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetResponse getAssetByQaCode(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        return mapToAssetResponse(asset, false);
    }

    @Transactional
    public AssetResponse updateAsset(String qaCode, AssetUpdateRequest request) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String oldName = asset.getName();
        String oldCategory = asset.getCategory().getName();
        String oldStatus = asset.getStatus();
        String oldHome = asset.getHomeLocation().getRoomName();

        if (StringUtils.hasText(request.getName())) {
            asset.setName(request.getName());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
            asset.setCategory(category);
            asset.setLegacyCategoryName(category.getName());
        }
        if (StringUtils.hasText(request.getStatus())) {
            asset.setStatus(request.getStatus());
        }
        if (request.getLocationId() != null) {
            Location location = locationRepository.findById(request.getLocationId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
            asset.setLocation(location);
            asset.setHomeLocation(location);
        }
        Asset updated = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        notificationService.createNotification(
                "ASSET_UPDATE",
                "Cập nhật thiết bị",
                "Thiết bị " + updated.getQaCode() + " đã được cập nhật.",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.ofEntries(
                        Map.entry("Thiết bị", updated.getQaCode() + " - " + updated.getName()),
                        Map.entry("Tên cũ", oldName),
                        Map.entry("Tên mới", updated.getName()),
                        Map.entry("Loại cũ", oldCategory),
                        Map.entry("Loại mới", updated.getCategory().getName()),
                        Map.entry("Trạng thái cũ", oldStatus),
                        Map.entry("Trạng thái mới", updated.getStatus()),
                        Map.entry("Phòng gốc cũ", oldHome),
                        Map.entry("Phòng gốc mới", updated.getHomeLocation().getRoomName()),
                        Map.entry("Người thực hiện", actor.getUsername())
                )
        );
        return mapToAssetResponse(updated, false);
    }

    @Transactional
    public void deleteAsset(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String assetName = asset.getName();
        String categoryName = asset.getCategory().getName();
        String homeLocationName = asset.getHomeLocation().getRoomName();
        assetRepository.delete(asset);
        AppUser actor = getCurrentUser();
        notificationService.createNotification(
                "ASSET_DELETE",
                "Xóa thiết bị",
                "Thiết bị " + qaCode + " đã bị xóa.",
                actor.getUsername(),
                qaCode,
                assetName,
                Map.of(
                        "Mã thiết bị", qaCode,
                        "Tên thiết bị", assetName,
                        "Loại", categoryName,
                        "Phòng gốc", homeLocationName,
                        "Người thực hiện", actor.getUsername()
                )
        );
    }

    private AssetResponse mapToAssetResponse(Asset asset, boolean includeQrCode) {
        String qrCodeBase64 = null;
        if (includeQrCode) {
            String qrContent = "{\"qa_code\":\"" + asset.getQaCode() + "\"}";
            qrCodeBase64 = qrCodeGenerator.generateBase64QrCode(qrContent);
        }
        return AssetResponse.builder()
                .qaCode(asset.getQaCode())
                .name(asset.getName())
                .categoryId(asset.getCategory().getId())
                .category(asset.getCategory().getName())
                .status(asset.getStatus())
                .locationId(asset.getLocation().getId())
                .locationName(asset.getLocation().getRoomName())
                .homeLocationId(asset.getHomeLocation().getId())
                .homeLocationName(asset.getHomeLocation().getRoomName())
                .qrCodeBase64(qrCodeBase64)
                .build();
    }

    private void validateCreateRequest(AssetCreateRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu tạo thiết bị không được để trống.");
        }
        if (!StringUtils.hasText(request.getQaCode())) {
            throw new CustomException("qaCode là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getName())) {
            throw new CustomException("name là bắt buộc.");
        }
        if (request.getCategoryId() == null) {
            throw new CustomException("categoryId là bắt buộc.");
        }
        if (request.getLocationId() == null) {
            throw new CustomException("locationId là bắt buộc.");
        }
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
