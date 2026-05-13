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
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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
        Location location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
        String generatedQaCode = generateQaCode(category);

        Asset asset = Asset.builder()
                .qaCode(generatedQaCode)
                .name(request.getName())
                .category(category)
                .status("Sẵn sàng")
                .location(location)
                .homeLocation(location)
                .build();
        Asset saved = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_CREATE",
                "Thêm mới thiết bị",
                actorDisplayName + " đã thêm thiết bị " + saved.getName()
                        + " tại phòng gốc " + saved.getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                saved.getQaCode(),
                saved.getName(),
                Map.of(
                        "Thiết bị", saved.getQaCode() + " - " + saved.getName(),
                        "Loại", getCategoryDisplayName(saved.getCategory()),
                        "Phòng gốc", saved.getHomeLocation().getRoomName(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToAssetResponse(saved, true);
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> getAllAssets() {
        return assetRepository.searchForAdmin(null, null, null, null).stream()
                .map(asset -> mapToAssetResponse(asset, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> searchAssets(String name, String status, Integer categoryId, Integer locationId) {
        String normalizedName = StringUtils.hasText(name) ? name.trim() : null;
        String normalizedStatus = StringUtils.hasText(status) ? status.trim() : null;
        String searchKey = normalizeKeyword(normalizedName);
        return assetRepository.searchForAdmin(null, normalizedStatus, categoryId, locationId).stream()
                .filter(asset -> {
                    if (searchKey == null) {
                        return true;
                    }
                    return normalizeKeyword(asset.getName()).contains(searchKey);
                })
                .map(asset -> mapToAssetResponse(asset, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetResponse getAssetByQaCode(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        return mapToAssetResponse(asset, true);
    }

    @Transactional
    public AssetResponse updateAsset(String qaCode, AssetUpdateRequest request) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String oldName = asset.getName();
        String oldCategory = getCategoryDisplayName(asset.getCategory());
        String oldStatus = asset.getStatus();
        String oldHome = asset.getHomeLocation().getRoomName();

        if (StringUtils.hasText(request.getName())) {
            asset.setName(request.getName());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
            asset.setCategory(category);
        }
        if (request.getLocationId() != null) {
            Location location = locationRepository.findById(request.getLocationId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
            asset.setLocation(location);
            asset.setHomeLocation(location);
        }
        Asset updated = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_UPDATE",
                "Cập nhật thiết bị",
                actorDisplayName + " đã cập nhật thiết bị " + updated.getName()
                        + " tại phòng gốc " + updated.getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.ofEntries(
                        Map.entry("Thiết bị", updated.getQaCode() + " - " + updated.getName()),
                        Map.entry("Tên cũ", oldName),
                        Map.entry("Tên mới", updated.getName()),
                        Map.entry("Loại cũ", oldCategory),
                        Map.entry("Loại mới", getCategoryDisplayName(updated.getCategory())),
                        Map.entry("Trạng thái cũ", oldStatus),
                        Map.entry("Trạng thái mới", updated.getStatus()),
                        Map.entry("Phòng gốc cũ", oldHome),
                        Map.entry("Phòng gốc mới", updated.getHomeLocation().getRoomName()),
                        Map.entry("Người thực hiện", actorDisplayName)
                )
        );
        return mapToAssetResponse(updated, false);
    }

    @Transactional
    public void deleteAsset(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String assetName = asset.getName();
        String categoryName = getCategoryDisplayName(asset.getCategory());
        String homeLocationName = asset.getHomeLocation().getRoomName();
        assetRepository.delete(asset);
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_DELETE",
                "Xóa thiết bị",
                actorDisplayName + " đã xóa thiết bị " + assetName
                        + " tại phòng gốc " + homeLocationName + ".",
                actor.getUsername(),
                qaCode,
                assetName,
                Map.of(
                        "Mã thiết bị", qaCode,
                        "Tên thiết bị", assetName,
                        "Loại", categoryName,
                        "Phòng gốc", homeLocationName,
                        "Người thực hiện", actorDisplayName
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
                .category(getCategoryDisplayName(asset.getCategory()))
                .status(asset.getStatus())
                .locationId(asset.getLocation().getId())
                .locationName(asset.getLocation().getRoomName())
                .homeLocationId(asset.getHomeLocation().getId())
                .homeLocationName(asset.getHomeLocation().getRoomName())
                .qrCodeBase64(qrCodeBase64)
                .build();
    }

    private String getCategoryDisplayName(Category category) {
        return category == null ? null : category.getName();
    }

    private String normalizeKeyword(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT);
    }

    private String generateQaCode(Category category) {
        String prefix = normalizeCodePrefix(category.getCodePrefix());
        int currentMax = assetRepository.findByCategoryId(category.getId()).stream()
                .map(Asset::getQaCode)
                .filter(StringUtils::hasText)
                .filter(qaCode -> qaCode.startsWith(prefix))
                .map(qaCode -> extractNumericSuffix(qaCode, prefix))
                .filter(number -> number > 0)
                .max(Comparator.naturalOrder())
                .orElse(0);

        int nextNumber = currentMax + 1;
        while (nextNumber <= 9999) {
            String candidate = prefix + String.format("%04d", nextNumber);
            if (!assetRepository.existsById(candidate)) {
                return candidate;
            }
            nextNumber++;
        }
        throw new CustomException("Đã vượt giới hạn sinh mã thiết bị cho loại " + category.getName() + ".");
    }

    private String normalizeCodePrefix(String codePrefix) {
        String normalizedPrefix = codePrefix == null ? null : codePrefix.trim().toUpperCase(Locale.ROOT);
        if (!StringUtils.hasText(normalizedPrefix)) {
            throw new CustomException("Loại thiết bị chưa được cấu hình code prefix.");
        }
        return normalizedPrefix;
    }

    private int extractNumericSuffix(String qaCode, String prefix) {
        if (!StringUtils.hasText(qaCode) || !qaCode.startsWith(prefix)) {
            return -1;
        }
        String suffix = qaCode.substring(prefix.length());
        if (!suffix.matches("\\d{4}")) {
            return -1;
        }
        return Integer.parseInt(suffix);
    }

    private void validateCreateRequest(AssetCreateRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu tạo thiết bị không được để trống.");
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
