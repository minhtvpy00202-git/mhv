package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetAdminListItemResponse;
import com.poly.mhv.dto.asset.ConsumableIssueRequest;
import com.poly.mhv.dto.asset.ConsumableIssueResponse;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ConsumableIssue;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.ConsumableIssueRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.SupplierRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.util.QRCodeGenerator;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AssetService {

    private static final long ASSET_DETAIL_CACHE_TTL_MS = 60_000L;
    private static final long ASSET_QR_CACHE_TTL_MS = 300_000L;
    private static final String TRACKING_MODE_ITEMIZED = "ITEMIZED";
    private static final String TRACKING_MODE_CONSUMABLE = "CONSUMABLE";
    private static final String CATEGORY_KIND_ITEMIZED = "ITEMIZED";
    private static final String CATEGORY_KIND_CONSUMABLE = "CONSUMABLE";

    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final CategoryRepository categoryRepository;
    private final ConsumableIssueRepository consumableIssueRepository;
    private final LocationRepository locationRepository;
    private final SupplierRepository supplierRepository;
    private final QRCodeGenerator qrCodeGenerator;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final Map<String, CachedAssetResponse> assetDetailCache = new ConcurrentHashMap<>();
    private final Map<String, CachedAssetQr> assetQrCache = new ConcurrentHashMap<>();

    public AssetService(
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            CategoryRepository categoryRepository,
            ConsumableIssueRepository consumableIssueRepository,
            LocationRepository locationRepository,
            SupplierRepository supplierRepository,
            QRCodeGenerator qrCodeGenerator,
            NotificationService notificationService,
            ObjectMapper objectMapper
    ) {
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.categoryRepository = categoryRepository;
        this.consumableIssueRepository = consumableIssueRepository;
        this.locationRepository = locationRepository;
        this.supplierRepository = supplierRepository;
        this.qrCodeGenerator = qrCodeGenerator;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AssetResponse createAsset(AssetCreateRequest request) {
        String trackingMode = normalizeTrackingMode(request != null ? request.getTrackingMode() : null);
        validateCreateRequest(request, trackingMode);
        Location location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
        validateCategoryCompatibility(category, trackingMode);
        Supplier supplier = request.getSupplierId() == null ? null : getSupplierOrThrow(request.getSupplierId());
        String generatedQaCode = generateQaCode(category);

        boolean consumable = isConsumableMode(trackingMode);
        Asset asset = Asset.builder()
                .qaCode(generatedQaCode)
                .trackingMode(trackingMode)
                .name(request.getName())
                .category(category)
                .status(consumable ? computeConsumableStatus(request.getQuantityOnHand(), request.getMinimumStock()) : "Sẵn sàng")
                .location(location)
                .homeLocation(location)
                .specs(normalizeSpecs(request.getSpecs()))
                .purchasePrice(request.getPurchasePrice())
                .purchaseDate(request.getPurchaseDate())
                .warrantyExpirationDate(consumable ? null : request.getWarrantyExpirationDate())
                .quantityOnHand(consumable ? safeInteger(request.getQuantityOnHand()) : null)
                .minimumStock(consumable ? safeInteger(request.getMinimumStock()) : null)
                .unit(consumable ? normalizeUnit(request.getUnit()) : null)
                .supplier(supplier)
                .build();
        Asset saved = assetRepository.save(asset);
        invalidateAssetCaches(saved.getQaCode());
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_CREATE",
                consumable ? "Thêm mới vật tư tiêu hao" : "Thêm mới thiết bị",
                actorDisplayName + " đã thêm " + (consumable ? "vật tư" : "thiết bị") + " " + saved.getName()
                        + " tại phòng gốc " + saved.getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                saved.getQaCode(),
                saved.getName(),
                Map.of(
                        consumable ? "Vật tư" : "Thiết bị", saved.getQaCode() + " - " + saved.getName(),
                        "Loại", getCategoryDisplayName(saved.getCategory()),
                        "Phòng gốc", saved.getHomeLocation().getRoomName(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actorDisplayName
                )
        );
        notifyLowStockIfNeeded(saved, actor);
        return mapToAssetResponse(saved, isItemizedMode(saved.getTrackingMode()), true);
    }

    @Transactional(readOnly = true)
    public PagedResponse<AssetResponse> getAssets(
            int page,
            int size,
            String name,
            String status,
            String trackingMode,
            Integer categoryId,
            Integer locationId,
            String sortKey,
            String sortDirection
    ) {
        String normalizedName = StringUtils.hasText(name) ? name.trim() : null;
        String normalizedStatus = StringUtils.hasText(status) ? status.trim() : null;
        String normalizedTrackingMode = StringUtils.hasText(trackingMode) ? normalizeTrackingMode(trackingMode) : null;
        PageRequest pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(size, 100)),
                buildSort(sortKey, sortDirection)
        );
        Page<AssetAdminListItemResponse> assetPage = assetRepository.searchForAdmin(
                normalizedName,
                normalizedStatus,
                normalizedTrackingMode,
                categoryId,
                locationId,
                pageable
        );
        return new PagedResponse<>(
                assetPage.getContent().stream()
                        .map(this::mapToAssetListResponse)
                        .toList(),
                assetPage.getNumber(),
                assetPage.getSize(),
                Math.max(1, assetPage.getTotalPages()),
                assetPage.getTotalElements()
        );
    }

    @Transactional(readOnly = true)
    public AssetResponse getAssetByQaCode(String qaCode) {
        CachedAssetResponse cacheSnapshot = assetDetailCache.get(qaCode);
        if (cacheSnapshot != null && !cacheSnapshot.isExpired()) {
            return cacheSnapshot.response();
        }
        Asset asset = assetRepository.findDetailByQaCode(qaCode)
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        AssetResponse response = mapToAssetResponse(asset, false, true);
        assetDetailCache.put(qaCode, new CachedAssetResponse(response, System.currentTimeMillis() + ASSET_DETAIL_CACHE_TTL_MS));
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, String> getAssetQrByQaCode(String qaCode) {
        String normalizedQaCode = qaCode == null ? null : qaCode.trim();
        if (!StringUtils.hasText(normalizedQaCode)) {
            throw new CustomException("Mã tài sản không hợp lệ.");
        }
        CachedAssetQr cacheSnapshot = assetQrCache.get(normalizedQaCode);
        if (cacheSnapshot != null && !cacheSnapshot.isExpired()) {
            return Map.of("qaCode", normalizedQaCode, "qrCodeBase64", cacheSnapshot.qrCodeBase64());
        }
        Asset asset = assetRepository.findById(normalizedQaCode)
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        if (isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Vật tư tiêu hao không sử dụng mã QR riêng.");
        }
        String qrCodeBase64 = generateAndCacheAssetQr(asset);
        return Map.of("qaCode", normalizedQaCode, "qrCodeBase64", qrCodeBase64);
    }

    @Transactional
    public AssetResponse updateAsset(String qaCode, AssetUpdateRequest request) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String oldName = asset.getName();
        String oldCategory = getCategoryDisplayName(asset.getCategory());
        String oldStatus = asset.getStatus();
        String oldHome = asset.getHomeLocation().getRoomName();
        String trackingMode = normalizeTrackingMode(asset.getTrackingMode());

        if (StringUtils.hasText(request.getTrackingMode())) {
            String requestedTrackingMode = normalizeTrackingMode(request.getTrackingMode());
            if (!requestedTrackingMode.equals(trackingMode)) {
                throw new CustomException("Không hỗ trợ chuyển đổi kiểu theo dõi của tài sản đã tạo.");
            }
        }

        if (StringUtils.hasText(request.getName())) {
            asset.setName(request.getName());
        }
        if (StringUtils.hasText(request.getStatus()) && isItemizedMode(trackingMode)) {
            asset.setStatus(request.getStatus().trim());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
            validateCategoryCompatibility(category, trackingMode);
            asset.setCategory(category);
        }
        if (request.getLocationId() != null) {
            Location location = locationRepository.findById(request.getLocationId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
            asset.setLocation(location);
            asset.setHomeLocation(location);
        }
        if (request.getSpecs() != null) {
            asset.setSpecs(normalizeSpecs(request.getSpecs()));
        }
        if (request.getPurchasePrice() != null) {
            asset.setPurchasePrice(request.getPurchasePrice());
        }
        if (request.getPurchaseDate() != null) {
            asset.setPurchaseDate(request.getPurchaseDate());
        }
        if (request.getWarrantyExpirationDate() != null && isItemizedMode(trackingMode)) {
            asset.setWarrantyExpirationDate(request.getWarrantyExpirationDate());
        }
        if (request.getSupplierId() != null) {
            asset.setSupplier(getSupplierOrThrow(request.getSupplierId()));
        }
        if (isConsumableMode(trackingMode)) {
            if (request.getQuantityOnHand() != null) {
                asset.setQuantityOnHand(request.getQuantityOnHand());
            }
            if (request.getMinimumStock() != null) {
                asset.setMinimumStock(request.getMinimumStock());
            }
            if (request.getUnit() != null) {
                asset.setUnit(normalizeUnit(request.getUnit()));
            }
            validateConsumableState(asset);
            asset.setWarrantyExpirationDate(null);
            asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        } else {
            validatePurchaseInfo(asset.getPurchasePrice(), asset.getPurchaseDate(), asset.getWarrantyExpirationDate());
        }
        Asset updated = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_UPDATE",
                isConsumableMode(trackingMode) ? "Cập nhật vật tư tiêu hao" : "Cập nhật thiết bị",
                actorDisplayName + " đã cập nhật " + (isConsumableMode(trackingMode) ? "vật tư" : "thiết bị") + " " + updated.getName()
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
        notifyLowStockIfNeeded(updated, actor);
        AssetResponse response = mapToAssetResponse(updated, false, true);
        invalidateAssetCaches(updated.getQaCode());
        return response;
    }

    @Transactional
    public ConsumableIssueResponse issueConsumable(String qaCode, ConsumableIssueRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu cấp phát vật tư không được để trống.");
        }
        Asset asset = assetRepository.findDetailByQaCode(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Chỉ vật tư tiêu hao mới hỗ trợ cấp phát theo số lượng.");
        }
        if (request.getIssuedToLocationId() == null) {
            throw new CustomException("issuedToLocationId là bắt buộc.");
        }
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new CustomException("quantity phải lớn hơn 0.");
        }
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        if (currentQuantity < request.getQuantity()) {
            throw new CustomException("Số lượng tồn không đủ để cấp phát.");
        }
        Location issuedToLocation = locationRepository.findById(request.getIssuedToLocationId())
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng nhận với id: " + request.getIssuedToLocationId()));
        AppUser actor = getCurrentUser();

        asset.setQuantityOnHand(currentQuantity - request.getQuantity());
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);

        ConsumableIssue issue = ConsumableIssue.builder()
                .asset(updated)
                .issuedToLocation(issuedToLocation)
                .issuedBy(actor)
                .quantity(request.getQuantity())
                .note(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null)
                .issuedAt(LocalDateTime.now())
                .build();
        ConsumableIssue savedIssue = consumableIssueRepository.save(issue);
        invalidateAssetCaches(updated.getQaCode());

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_ISSUED",
                "Cấp phát vật tư",
                actorDisplayName + " đã cấp phát " + request.getQuantity() + " " + safeUnit(updated)
                        + " " + updated.getName() + " cho phòng " + issuedToLocation.getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Số lượng cấp phát", request.getQuantity(),
                        "Đơn vị tính", safeUnit(updated),
                        "Phòng nhận", issuedToLocation.getRoomName(),
                        "Tồn còn lại", safeInteger(updated.getQuantityOnHand()),
                        "Người thực hiện", actorDisplayName
                )
        );
        notifyLowStockIfNeeded(updated, actor);
        return mapToConsumableIssueResponse(savedIssue);
    }

    @Transactional(readOnly = true)
    public List<ConsumableIssueResponse> getConsumableIssueHistory(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Tài sản này không có lịch sử cấp phát vật tư.");
        }
        return consumableIssueRepository.findByAssetQaCodeOrderByIssuedAtDescIdDesc(qaCode).stream()
                .map(this::mapToConsumableIssueResponse)
                .toList();
    }

    @Transactional
    public void deleteAsset(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String assetName = asset.getName();
        String categoryName = getCategoryDisplayName(asset.getCategory());
        String homeLocationName = asset.getHomeLocation().getRoomName();
        assetRepository.delete(asset);
        invalidateAssetCaches(qaCode);
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

    private AssetResponse mapToAssetResponse(Asset asset, boolean includeQrCode, boolean includeSpecs) {
        String qrCodeBase64 = null;
        if (includeQrCode && isItemizedMode(asset.getTrackingMode())) {
            String qrContent = "{\"qa_code\":\"" + asset.getQaCode() + "\"}";
            qrCodeBase64 = qrCodeGenerator.generateBase64QrCode(qrContent);
        }
        Location effectiveHomeLocation = asset.getHomeLocation() != null ? asset.getHomeLocation() : asset.getLocation();
        return AssetResponse.builder()
                .qaCode(asset.getQaCode())
                .trackingMode(normalizeTrackingMode(asset.getTrackingMode()))
                .name(asset.getName())
                .categoryId(asset.getCategory().getId())
                .category(getCategoryDisplayName(asset.getCategory()))
                .status(asset.getStatus())
                .locationId(asset.getLocation().getId())
                .locationName(asset.getLocation().getRoomName())
                .homeLocationId(effectiveHomeLocation != null ? effectiveHomeLocation.getId() : null)
                .homeLocationName(effectiveHomeLocation != null ? effectiveHomeLocation.getRoomName() : null)
                .specs(includeSpecs ? asset.getSpecs() : null)
                .purchasePrice(asset.getPurchasePrice())
                .purchaseDate(asset.getPurchaseDate())
                .warrantyExpirationDate(asset.getWarrantyExpirationDate())
                .quantityOnHand(asset.getQuantityOnHand())
                .minimumStock(asset.getMinimumStock())
                .unit(asset.getUnit())
                .supplierId(asset.getSupplier() != null ? asset.getSupplier().getId() : null)
                .supplierName(asset.getSupplier() != null ? asset.getSupplier().getName() : null)
                .supplierAddress(asset.getSupplier() != null ? asset.getSupplier().getAddress() : null)
                .supplierPhoneNumber(asset.getSupplier() != null ? asset.getSupplier().getPhoneNumber() : null)
                .qrCodeBase64(qrCodeBase64)
                .build();
    }

    private void invalidateAssetCaches(String qaCode) {
        if (!StringUtils.hasText(qaCode)) {
            return;
        }
        assetDetailCache.remove(qaCode);
        assetQrCache.remove(qaCode);
    }

    private String generateAndCacheAssetQr(Asset asset) {
        String qrContent = "{\"qa_code\":\"" + asset.getQaCode() + "\"}";
        CustomException lastException = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                String qrCodeBase64 = qrCodeGenerator.generateBase64QrCode(qrContent);
                if (StringUtils.hasText(qrCodeBase64)) {
                    assetQrCache.put(
                            asset.getQaCode(),
                            new CachedAssetQr(qrCodeBase64, System.currentTimeMillis() + ASSET_QR_CACHE_TTL_MS)
                    );
                    return qrCodeBase64;
                }
            } catch (CustomException ex) {
                lastException = ex;
            }
            assetQrCache.remove(asset.getQaCode());
        }
        if (lastException != null) {
            throw lastException;
        }
        throw new CustomException("Không thể sinh mã QR cho thiết bị.");
    }

    private AssetResponse mapToAssetListResponse(AssetAdminListItemResponse item) {
        return AssetResponse.builder()
                .qaCode(item.getQaCode())
                .trackingMode(normalizeTrackingMode(item.getTrackingMode()))
                .name(item.getName())
                .categoryId(item.getCategoryId())
                .category(item.getCategoryName())
                .status(item.getStatus())
                .locationId(item.getLocationId())
                .locationName(item.getLocationName())
                .homeLocationId(item.getHomeLocationId())
                .homeLocationName(item.getHomeLocationName())
                .quantityOnHand(item.getQuantityOnHand())
                .minimumStock(item.getMinimumStock())
                .unit(item.getUnit())
                .supplierId(item.getSupplierId())
                .supplierName(item.getSupplierName())
                .build();
    }

    private String getCategoryDisplayName(Category category) {
        return category == null ? null : category.getName();
    }

    private void validateCategoryCompatibility(Category category, String trackingMode) {
        if (category == null) {
            throw new CustomException("Loại tài sản là bắt buộc.");
        }
        String categoryKind = normalizeCategoryKind(category.getCategoryKind());
        if (isConsumableMode(trackingMode) && !CATEGORY_KIND_CONSUMABLE.equals(categoryKind)) {
            throw new CustomException("Vật tư tiêu hao phải dùng category loại tiêu hao.");
        }
        if (isItemizedMode(trackingMode) && !CATEGORY_KIND_ITEMIZED.equals(categoryKind)) {
            throw new CustomException("Thiết bị đơn chiếc phải dùng category loại đơn chiếc.");
        }
    }

    private Sort buildSort(String sortKey, String sortDirection) {
        String normalizedSortKey = StringUtils.hasText(sortKey) ? sortKey.trim() : "qaCode";
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return switch (normalizedSortKey) {
            case "name" -> Sort.by(direction, "name").and(Sort.by(Sort.Direction.ASC, "qaCode"));
            case "category" -> Sort.by(direction, "category.name").and(Sort.by(Sort.Direction.ASC, "qaCode"));
            case "trackingMode" -> Sort.by(direction, "trackingMode").and(Sort.by(Sort.Direction.ASC, "qaCode"));
            case "status" -> Sort.by(direction, "status").and(Sort.by(Sort.Direction.ASC, "qaCode"));
            case "homeLocationName" -> Sort.by(direction, "homeLocation.roomName").and(Sort.by(Sort.Direction.ASC, "qaCode"));
            default -> Sort.by(direction, "qaCode");
        };
    }

    private String generateQaCode(Category category) {
        String prefix = normalizeCodePrefix(category.getCodePrefix());
        int currentMax = assetRepository.findMaxQaCodeByCategoryIdAndPrefix(category.getId(), prefix)
                .map(qaCode -> extractNumericSuffix(qaCode, prefix))
                .filter(number -> number > 0)
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

    private void validateCreateRequest(AssetCreateRequest request, String trackingMode) {
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
        if (isConsumableMode(trackingMode)) {
            validateConsumableRequest(request);
            validatePurchaseInfo(request.getPurchasePrice(), request.getPurchaseDate(), null);
            return;
        }
        if (request.getSupplierId() == null) {
            throw new CustomException("supplierId là bắt buộc.");
        }
        if (request.getPurchasePrice() == null) {
            throw new CustomException("purchasePrice là bắt buộc.");
        }
        if (request.getPurchasePrice().signum() <= 0) {
            throw new CustomException("Giá mua phải lớn hơn 0.");
        }
        if (request.getPurchaseDate() == null) {
            throw new CustomException("purchaseDate là bắt buộc.");
        }
        if (request.getWarrantyExpirationDate() == null) {
            throw new CustomException("warrantyExpirationDate là bắt buộc.");
        }
        validatePurchaseInfo(request.getPurchasePrice(), request.getPurchaseDate(), request.getWarrantyExpirationDate());
    }

    private Supplier getSupplierOrThrow(Integer supplierId) {
        return supplierRepository.findById(supplierId)
                .orElseThrow(() -> new CustomException("Không tìm thấy nhà cung cấp với id: " + supplierId));
    }

    private void validatePurchaseInfo(
            java.math.BigDecimal purchasePrice,
            LocalDate purchaseDate,
            LocalDate warrantyExpirationDate
    ) {
        if (purchasePrice != null && purchasePrice.signum() <= 0) {
            throw new CustomException("Giá mua phải lớn hơn 0.");
        }
        if (purchaseDate != null && warrantyExpirationDate != null && warrantyExpirationDate.isBefore(purchaseDate)) {
            throw new CustomException("Hạn bảo hành không được nhỏ hơn ngày mua.");
        }
    }

    private void validateConsumableRequest(AssetCreateRequest request) {
        if (request.getQuantityOnHand() == null) {
            throw new CustomException("quantityOnHand là bắt buộc cho vật tư tiêu hao.");
        }
        if (request.getQuantityOnHand() < 0) {
            throw new CustomException("Số lượng tồn không được âm.");
        }
        if (request.getMinimumStock() == null) {
            throw new CustomException("minimumStock là bắt buộc cho vật tư tiêu hao.");
        }
        if (request.getMinimumStock() < 0) {
            throw new CustomException("Ngưỡng cảnh báo tồn không được âm.");
        }
        if (!StringUtils.hasText(request.getUnit())) {
            throw new CustomException("unit là bắt buộc cho vật tư tiêu hao.");
        }
    }

    private void validateConsumableState(Asset asset) {
        if (asset.getQuantityOnHand() == null) {
            throw new CustomException("quantityOnHand là bắt buộc cho vật tư tiêu hao.");
        }
        if (asset.getQuantityOnHand() < 0) {
            throw new CustomException("Số lượng tồn không được âm.");
        }
        if (asset.getMinimumStock() == null) {
            throw new CustomException("minimumStock là bắt buộc cho vật tư tiêu hao.");
        }
        if (asset.getMinimumStock() < 0) {
            throw new CustomException("Ngưỡng cảnh báo tồn không được âm.");
        }
        asset.setUnit(normalizeUnit(asset.getUnit()));
    }

    private String normalizeTrackingMode(String trackingMode) {
        if (!StringUtils.hasText(trackingMode)) {
            return TRACKING_MODE_ITEMIZED;
        }
        String normalized = trackingMode.trim().toUpperCase(Locale.ROOT);
        if (!TRACKING_MODE_ITEMIZED.equals(normalized) && !TRACKING_MODE_CONSUMABLE.equals(normalized)) {
            throw new CustomException("Kiểu theo dõi tài sản không hợp lệ.");
        }
        return normalized;
    }

    private String normalizeCategoryKind(String categoryKind) {
        if (!StringUtils.hasText(categoryKind)) {
            return CATEGORY_KIND_ITEMIZED;
        }
        String normalized = categoryKind.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORY_KIND_ITEMIZED.equals(normalized) && !CATEGORY_KIND_CONSUMABLE.equals(normalized)) {
            throw new CustomException("Loại category không hợp lệ.");
        }
        return normalized;
    }

    private boolean isConsumableMode(String trackingMode) {
        return TRACKING_MODE_CONSUMABLE.equals(normalizeTrackingMode(trackingMode));
    }

    private boolean isItemizedMode(String trackingMode) {
        return TRACKING_MODE_ITEMIZED.equals(normalizeTrackingMode(trackingMode));
    }

    private String computeConsumableStatus(Integer quantityOnHand, Integer minimumStock) {
        int safeQuantity = safeInteger(quantityOnHand);
        int safeMinimum = safeInteger(minimumStock);
        if (safeQuantity <= 0) {
            return "Hết hàng";
        }
        if (safeQuantity <= safeMinimum) {
            return "Sắp hết";
        }
        return "Còn hàng";
    }

    private int safeInteger(Integer value) {
        return value == null ? 0 : value;
    }

    private String normalizeUnit(String unit) {
        String normalized = unit == null ? null : unit.trim();
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Đơn vị tính là bắt buộc.");
        }
        return normalized;
    }

    private String safeUnit(Asset asset) {
        return StringUtils.hasText(asset.getUnit()) ? asset.getUnit() : "đơn vị";
    }

    private void notifyLowStockIfNeeded(Asset asset, AppUser actor) {
        if (!isConsumableMode(asset.getTrackingMode())) {
            return;
        }
        int quantityOnHand = safeInteger(asset.getQuantityOnHand());
        int minimumStock = safeInteger(asset.getMinimumStock());
        if (quantityOnHand > minimumStock) {
            return;
        }
        notificationService.createNotification(
                "CONSUMABLE_LOW_STOCK",
                quantityOnHand <= 0 ? "Vật tư đã hết hàng" : "Vật tư sắp hết",
                asset.getName() + " hiện còn " + quantityOnHand + " " + safeUnit(asset)
                        + " tại kho/phòng " + asset.getHomeLocation().getRoomName() + ".",
                actor != null ? actor.getUsername() : "system",
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Vật tư", asset.getQaCode() + " - " + asset.getName(),
                        "Tồn hiện tại", quantityOnHand,
                        "Ngưỡng cảnh báo", minimumStock,
                        "Đơn vị tính", safeUnit(asset),
                        "Phòng lưu", asset.getHomeLocation().getRoomName()
                )
        );
    }

    private ConsumableIssueResponse mapToConsumableIssueResponse(ConsumableIssue issue) {
        return ConsumableIssueResponse.builder()
                .id(issue.getId())
                .assetQaCode(issue.getAsset().getQaCode())
                .assetName(issue.getAsset().getName())
                .issuedToLocationId(issue.getIssuedToLocation().getId())
                .issuedToLocationName(issue.getIssuedToLocation().getRoomName())
                .quantity(issue.getQuantity())
                .unit(issue.getAsset().getUnit())
                .note(issue.getNote())
                .issuedByUserId(issue.getIssuedBy().getId())
                .issuedByUsername(issue.getIssuedBy().getUsername())
                .issuedByFullName(issue.getIssuedBy().getFullName())
                .issuedAt(issue.getIssuedAt())
                .build();
    }

    private String normalizeSpecs(String specs) {
        if (!StringUtils.hasText(specs)) {
            return "{}";
        }
        try {
            LinkedHashMap<String, Object> rawSpecs = objectMapper.readValue(
                    specs,
                    new TypeReference<LinkedHashMap<String, Object>>() {
                    }
            );
            LinkedHashMap<String, String> normalizedSpecs = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : rawSpecs.entrySet()) {
                String key = entry.getKey() == null ? "" : entry.getKey().trim();
                String value = entry.getValue() == null ? "" : String.valueOf(entry.getValue()).trim();
                if (StringUtils.hasText(key) && StringUtils.hasText(value)) {
                    normalizedSpecs.put(key, value);
                }
            }
            return objectMapper.writeValueAsString(normalizedSpecs);
        } catch (JsonProcessingException ex) {
            throw new CustomException("Đặc tính kỹ thuật phải là JSON object hợp lệ.");
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

    private record CachedAssetResponse(AssetResponse response, long expiresAt) {
        private boolean isExpired() {
            return expiresAt <= System.currentTimeMillis();
        }
    }

    private record CachedAssetQr(String qrCodeBase64, long expiresAt) {
        private boolean isExpired() {
            return expiresAt <= System.currentTimeMillis();
        }
    }
}
