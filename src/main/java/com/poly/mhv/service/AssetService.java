package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetAdminListItemResponse;
import com.poly.mhv.dto.asset.ConsumableReceiptLotResponse;
import com.poly.mhv.dto.asset.ConsumableLocationOverviewResponse;
import com.poly.mhv.dto.asset.ConsumableLocationRemainingUpdateRequest;
import com.poly.mhv.dto.asset.ConsumableLocationStockResponse;
import com.poly.mhv.dto.asset.ConsumableIssueRequest;
import com.poly.mhv.dto.asset.ConsumableIssueResponse;
import com.poly.mhv.dto.asset.ConsumableRequestCreateRequest;
import com.poly.mhv.dto.asset.ConsumableRequestDecisionRequest;
import com.poly.mhv.dto.asset.ConsumableRequestResponse;
import com.poly.mhv.dto.asset.ConsumableStockReceiptRequest;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ConsumableIssue;
import com.poly.mhv.entity.ConsumableLocationStock;
import com.poly.mhv.entity.ConsumableReceiptLot;
import com.poly.mhv.entity.ConsumableRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.ConsumableIssueRepository;
import com.poly.mhv.repository.ConsumableLocationStockRepository;
import com.poly.mhv.repository.ConsumableReceiptLotRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.SupplierRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.util.QRCodeGenerator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
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
    private static final String DEFAULT_CONSUMABLE_STORAGE_ROOM = "Kho";

    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final CategoryRepository categoryRepository;
    private final ConsumableIssueRepository consumableIssueRepository;
    private final ConsumableLocationStockRepository consumableLocationStockRepository;
    private final ConsumableReceiptLotRepository consumableReceiptLotRepository;
    private final ConsumableRequestRepository consumableRequestRepository;
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
            ConsumableLocationStockRepository consumableLocationStockRepository,
            ConsumableReceiptLotRepository consumableReceiptLotRepository,
            ConsumableRequestRepository consumableRequestRepository,
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
        this.consumableLocationStockRepository = consumableLocationStockRepository;
        this.consumableReceiptLotRepository = consumableReceiptLotRepository;
        this.consumableRequestRepository = consumableRequestRepository;
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
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
        validateCategoryCompatibility(category, trackingMode);
        Supplier supplier = request.getSupplierId() == null ? null : getSupplierOrThrow(request.getSupplierId());
        String generatedQaCode = generateQaCode(category);

        boolean consumable = isConsumableMode(trackingMode);
        boolean expiryTrackingEnabled = consumable && isExpiryTrackingEnabled(request.getExpiryTrackingEnabled());
        Location location = consumable
                ? getConsumableStorageLocationOrThrow()
                : locationRepository.findById(request.getLocationId())
                        .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
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
                .expiryTrackingEnabled(consumable ? expiryTrackingEnabled : null)
                .expirationDate(consumable ? normalizeConsumableExpirationDate(
                        expiryTrackingEnabled,
                        request.getExpirationDate(),
                        request.getPurchaseDate()
                ) : null)
                .quantityOnHand(consumable ? safeInteger(request.getQuantityOnHand()) : null)
                .minimumStock(consumable ? safeInteger(request.getMinimumStock()) : null)
                .unit(consumable ? normalizeUnit(request.getUnit()) : null)
                .supplier(supplier)
                .build();
        AppUser actor = getCurrentUser();
        Asset saved = assetRepository.save(asset);
        if (consumable && safeInteger(saved.getQuantityOnHand()) > 0) {
            createConsumableReceiptLot(
                    saved,
                    supplier,
                    safeInteger(saved.getQuantityOnHand()),
                    saved.getPurchasePrice(),
                    request.getPurchaseDate(),
                    saved.getExpirationDate(),
                    "INIT-" + saved.getQaCode(),
                    "Tồn khởi tạo khi thêm mới vật tư.",
                    actor
            );
            refreshConsumableExpirySummary(saved);
            saved = assetRepository.save(saved);
        }
        invalidateAssetCaches(saved.getQaCode());
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
            if (isItemizedMode(trackingMode)) {
                Location location = locationRepository.findById(request.getLocationId())
                        .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + request.getLocationId()));
                asset.setLocation(location);
                asset.setHomeLocation(location);
            }
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
            Location storageLocation = getConsumableStorageLocationOrThrow();
            asset.setLocation(storageLocation);
            asset.setHomeLocation(storageLocation);
            if (request.getQuantityOnHand() != null) {
                if (!request.getQuantityOnHand().equals(asset.getQuantityOnHand())) {
                    throw new CustomException("Tồn kho tổng được quản lý theo từng lô nhập. Vui lòng dùng chức năng nhập hàng để cập nhật.");
                }
                asset.setQuantityOnHand(request.getQuantityOnHand());
            }
            if (request.getMinimumStock() != null) {
                asset.setMinimumStock(request.getMinimumStock());
            }
            if (request.getUnit() != null) {
                asset.setUnit(normalizeUnit(request.getUnit()));
            }
            if (request.getExpiryTrackingEnabled() != null) {
                boolean expiryTrackingEnabled = isExpiryTrackingEnabled(request.getExpiryTrackingEnabled());
                validateConsumableExpirySettingChange(asset.getQaCode(), expiryTrackingEnabled);
                asset.setExpiryTrackingEnabled(expiryTrackingEnabled);
            }
            validateConsumableState(asset);
            asset.setWarrantyExpirationDate(null);
            refreshConsumableExpirySummary(asset);
            asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        } else {
            asset.setExpiryTrackingEnabled(null);
            asset.setExpirationDate(null);
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
        LocalDateTime now = LocalDateTime.now();
        List<LotAllocation> allocations = allocateConsumableLots(asset, request.getQuantity());
        BigDecimal unitPrice = calculateAllocatedUnitPrice(allocations, request.getQuantity());
        String issueNote = appendLotAllocationNote(request.getNote(), allocations);

        asset.setQuantityOnHand(currentQuantity - request.getQuantity());
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        consumableReceiptLotRepository.saveAll(allocations.stream().map(LotAllocation::lot).toList());

        ConsumableIssue issue = ConsumableIssue.builder()
                .asset(updated)
                .issuedToLocation(issuedToLocation)
                .issuedBy(actor)
                .quantity(request.getQuantity())
                .unitPrice(unitPrice)
                .note(issueNote)
                .issuedAt(now)
                .build();
        ConsumableIssue savedIssue = consumableIssueRepository.save(issue);
        upsertConsumableLocationStock(updated, issuedToLocation, request.getQuantity(), unitPrice, now, actor, issueNote);
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

    @Transactional
    public AssetResponse receiveConsumableStock(String qaCode, ConsumableStockReceiptRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu nhập hàng không được để trống.");
        }
        Asset asset = assetRepository.findDetailByQaCode(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Chỉ vật tư tiêu hao mới hỗ trợ nhập hàng theo lô.");
        }

        int receiptQuantity = safePositiveInteger(request.getQuantity(), "Số lượng nhập phải lớn hơn 0.");
        if (request.getUnitPrice() == null || request.getUnitPrice().signum() <= 0) {
            throw new CustomException("Đơn giá nhập phải lớn hơn 0.");
        }
        Supplier supplier = getSupplierOrThrow(request.getSupplierId());
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        int nextQuantity = currentQuantity + receiptQuantity;
        BigDecimal averageUnitPrice = calculateAverageUnitPrice(
                asset.getPurchasePrice(),
                currentQuantity,
                request.getUnitPrice(),
                receiptQuantity
        );
        AppUser actor = getCurrentUser();

        asset.setQuantityOnHand(nextQuantity);
        asset.setPurchasePrice(averageUnitPrice);
        asset.setSupplier(supplier);
        createConsumableReceiptLot(
                asset,
                supplier,
                receiptQuantity,
                request.getUnitPrice(),
                request.getReceivedDate(),
                normalizeReceiptExpirationDate(asset, request),
                request.getLotCode(),
                request.getNote(),
                actor
        );
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        invalidateAssetCaches(updated.getQaCode());

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_RECEIVED",
                "Nhập hàng vật tư",
                actorDisplayName + " đã nhập thêm " + receiptQuantity + " " + safeUnit(updated)
                        + " " + updated.getName() + " về kho " + updated.getHomeLocation().getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Số lượng nhập", receiptQuantity,
                        "Đơn giá lô nhập", request.getUnitPrice(),
                        "Đơn giá trung bình", averageUnitPrice,
                        "Nhà cung cấp", supplier.getName(),
                        "Tồn sau nhập", nextQuantity + " " + safeUnit(updated),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToAssetResponse(updated, false, true);
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

    @Transactional(readOnly = true)
    public List<ConsumableLocationStockResponse> getConsumableLocationStocks(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Tài sản này không có tồn theo phòng.");
        }
        return consumableLocationStockRepository.findByAssetQaCodeOrderByLocationRoomNameAsc(qaCode).stream()
                .map(this::mapToConsumableLocationStockResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ConsumableLocationOverviewResponse getConsumableLocationOverview(Integer locationId) {
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + locationId));
        return ConsumableLocationOverviewResponse.builder()
                .locationId(location.getId())
                .locationName(location.getRoomName())
                .stocks(consumableLocationStockRepository.findByLocationIdOrderByAssetNameAsc(locationId).stream()
                        .map(this::mapToConsumableLocationStockResponse)
                        .toList())
                .issueHistory(consumableIssueRepository.findByIssuedToLocationIdOrderByIssuedAtDescIdDesc(locationId).stream()
                        .map(this::mapToConsumableIssueResponse)
                        .toList())
                .requestHistory(consumableRequestRepository.findByLocationIdOrderByCreatedAtDescIdDesc(locationId).stream()
                        .map(this::mapToConsumableRequestResponse)
                        .toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ConsumableRequestResponse> getConsumableRequests(String status) {
        List<ConsumableRequest> requests = StringUtils.hasText(status)
                ? consumableRequestRepository.findByStatusOrderByCreatedAtDescIdDesc(status.trim().toUpperCase())
                : consumableRequestRepository.findAllByOrderByCreatedAtDescIdDesc();
        return requests.stream()
                .map(this::mapToConsumableRequestResponse)
                .toList();
    }

    @Transactional
    public ConsumableRequestResponse createConsumableRequest(Integer locationId, ConsumableRequestCreateRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu yêu cầu cấp phát không được để trống.");
        }
        if (!StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("Mã vật tư là bắt buộc.");
        }
        if (request.getQuantityRequested() == null || request.getQuantityRequested() <= 0) {
            throw new CustomException("Số lượng yêu cầu phải lớn hơn 0.");
        }
        if (!StringUtils.hasText(request.getReason())) {
            throw new CustomException("Lý do cấp phát là bắt buộc.");
        }
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + locationId));
        Asset asset = assetRepository.findDetailByQaCode(request.getAssetQaCode().trim())
                .orElseThrow(() -> new CustomException("Không tìm thấy vật tư với mã: " + request.getAssetQaCode()));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Chỉ vật tư tiêu hao mới hỗ trợ yêu cầu cấp phát.");
        }
        AppUser requester = getCurrentUser();
        ConsumableRequest consumableRequest = ConsumableRequest.builder()
                .asset(asset)
                .location(location)
                .requestedBy(requester)
                .quantityRequested(request.getQuantityRequested())
                .reason(request.getReason().trim())
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();
        ConsumableRequest savedRequest = consumableRequestRepository.save(consumableRequest);
        notificationService.createNotification(
                "CONSUMABLE_REQUEST_CREATED",
                "Có yêu cầu cấp phát vật tư mới",
                getActorDisplayName(requester) + " vừa tạo yêu cầu cấp phát cho phòng " + location.getRoomName() + ".",
                requester.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Vật tư", asset.getQaCode() + " - " + asset.getName(),
                        "Phòng yêu cầu", location.getRoomName(),
                        "Số lượng yêu cầu", request.getQuantityRequested(),
                        "Lý do", request.getReason().trim(),
                        "Người yêu cầu", getActorDisplayName(requester)
                )
        );
        return mapToConsumableRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableRequestResponse approveConsumableRequest(Long requestId, ConsumableRequestDecisionRequest request) {
        ConsumableRequest consumableRequest = consumableRequestRepository.findById(requestId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu yêu cầu cấp phát."));
        if (!"PENDING".equalsIgnoreCase(consumableRequest.getStatus())) {
            throw new CustomException("Phiếu yêu cầu này đã được xử lý.");
        }
        Asset asset = assetRepository.findDetailByQaCode(consumableRequest.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy vật tư yêu cầu cấp phát."));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Phiếu này không áp dụng cho vật tư tiêu hao.");
        }
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        if (currentQuantity < safeInteger(consumableRequest.getQuantityRequested())) {
            throw new CustomException("Số lượng tồn không đủ để duyệt cấp phát phiếu này.");
        }

        AppUser actor = getCurrentUser();
        LocalDateTime now = LocalDateTime.now();
        List<LotAllocation> allocations = allocateConsumableLots(asset, consumableRequest.getQuantityRequested());
        BigDecimal unitPrice = calculateAllocatedUnitPrice(allocations, consumableRequest.getQuantityRequested());
        String decisionNote = request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
        String issueNote = appendLotAllocationNote(buildConsumableRequestIssueNote(consumableRequest, decisionNote), allocations);

        asset.setQuantityOnHand(currentQuantity - consumableRequest.getQuantityRequested());
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        consumableReceiptLotRepository.saveAll(allocations.stream().map(LotAllocation::lot).toList());

        ConsumableIssue issue = ConsumableIssue.builder()
                .asset(updated)
                .issuedToLocation(consumableRequest.getLocation())
                .issuedBy(actor)
                .quantity(consumableRequest.getQuantityRequested())
                .unitPrice(unitPrice)
                .note(issueNote)
                .issuedAt(now)
                .build();
        consumableIssueRepository.save(issue);
        upsertConsumableLocationStock(
                updated,
                consumableRequest.getLocation(),
                consumableRequest.getQuantityRequested(),
                unitPrice,
                now,
                actor,
                issueNote
        );

        consumableRequest.setStatus("APPROVED");
        consumableRequest.setDecisionNote(decisionNote);
        consumableRequest.setResolvedAt(now);
        consumableRequest.setResolvedBy(actor);
        ConsumableRequest savedRequest = consumableRequestRepository.save(consumableRequest);
        invalidateAssetCaches(updated.getQaCode());

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_REQUEST_APPROVED",
                "Phiếu yêu cầu cấp phát đã được duyệt",
                actorDisplayName + " đã duyệt cấp phát " + consumableRequest.getQuantityRequested() + " " + safeUnit(updated)
                        + " " + updated.getName() + " cho phòng " + consumableRequest.getLocation().getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Phiếu yêu cầu", "#" + consumableRequest.getId(),
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Phòng nhận", consumableRequest.getLocation().getRoomName(),
                        "Số lượng cấp phát", consumableRequest.getQuantityRequested(),
                        "Người duyệt", actorDisplayName,
                        "Ghi chú xử lý", decisionNote == null ? "" : decisionNote
                )
        );
        notifyLowStockIfNeeded(updated, actor);
        return mapToConsumableRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableRequestResponse rejectConsumableRequest(Long requestId, ConsumableRequestDecisionRequest request) {
        ConsumableRequest consumableRequest = consumableRequestRepository.findById(requestId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu yêu cầu cấp phát."));
        if (!"PENDING".equalsIgnoreCase(consumableRequest.getStatus())) {
            throw new CustomException("Phiếu yêu cầu này đã được xử lý.");
        }
        if (request == null || !StringUtils.hasText(request.getNote())) {
            throw new CustomException("Vui lòng nhập lý do từ chối phiếu yêu cầu.");
        }
        AppUser actor = getCurrentUser();
        LocalDateTime now = LocalDateTime.now();
        String decisionNote = request.getNote().trim();

        consumableRequest.setStatus("REJECTED");
        consumableRequest.setDecisionNote(decisionNote);
        consumableRequest.setResolvedAt(now);
        consumableRequest.setResolvedBy(actor);
        ConsumableRequest savedRequest = consumableRequestRepository.save(consumableRequest);

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_REQUEST_REJECTED",
                "Phiếu yêu cầu cấp phát bị từ chối",
                actorDisplayName + " đã từ chối phiếu yêu cầu cấp phát vật tư " + consumableRequest.getAsset().getName() + ".",
                actor.getUsername(),
                consumableRequest.getAsset().getQaCode(),
                consumableRequest.getAsset().getName(),
                Map.of(
                        "Phiếu yêu cầu", "#" + consumableRequest.getId(),
                        "Vật tư", consumableRequest.getAsset().getQaCode() + " - " + consumableRequest.getAsset().getName(),
                        "Phòng nhận", consumableRequest.getLocation().getRoomName(),
                        "Số lượng yêu cầu", consumableRequest.getQuantityRequested(),
                        "Người duyệt", actorDisplayName,
                        "Lý do từ chối", decisionNote
                )
        );
        return mapToConsumableRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableLocationStockResponse updateConsumableLocationRemaining(
            String qaCode,
            Integer locationId,
            ConsumableLocationRemainingUpdateRequest request
    ) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Tài sản này không quản lý tồn theo phòng.");
        }
        ConsumableLocationStock stock = consumableLocationStockRepository.findFirstByAssetQaCodeAndLocationId(qaCode, locationId)
                .orElseThrow(() -> new CustomException("Chưa có dữ liệu cấp phát cho vật tư này tại phòng đã chọn."));
        int nextRemaining = safeInteger(request.getQuantityRemaining());
        int quantityIssued = safeInteger(stock.getQuantityIssued());
        if (nextRemaining > quantityIssued) {
            throw new CustomException("Số lượng còn lại không được lớn hơn tổng số lượng đã cấp cho phòng này.");
        }
        AppUser actor = getCurrentUser();
        LocalDateTime now = LocalDateTime.now();
        stock.setQuantityRemaining(nextRemaining);
        stock.setLastUpdatedAt(now);
        stock.setLastUpdatedBy(actor);
        stock.setLastNote(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null);
        if (stock.getUnitPrice() == null) {
            stock.setUnitPrice(updatedUnitPrice(asset));
        }
        ConsumableLocationStock savedStock = consumableLocationStockRepository.save(stock);
        return mapToConsumableLocationStockResponse(savedStock);
    }

    @Transactional
    public void deleteAsset(String qaCode) {
        Asset asset = assetRepository.findById(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + qaCode));
        String assetName = asset.getName();
        String categoryName = getCategoryDisplayName(asset.getCategory());
        String homeLocationName = asset.getHomeLocation().getRoomName();
        if (isConsumableMode(asset.getTrackingMode())) {
            consumableReceiptLotRepository.deleteByAssetQaCode(qaCode);
        }
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
        String normalizedTrackingMode = normalizeTrackingMode(asset.getTrackingMode());
        return AssetResponse.builder()
                .qaCode(asset.getQaCode())
                .trackingMode(normalizedTrackingMode)
                .name(asset.getName())
                .categoryId(asset.getCategory().getId())
                .category(getCategoryDisplayName(asset.getCategory()))
                .status(isConsumableMode(normalizedTrackingMode) ? computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()) : asset.getStatus())
                .locationId(asset.getLocation().getId())
                .locationName(asset.getLocation().getRoomName())
                .homeLocationId(effectiveHomeLocation != null ? effectiveHomeLocation.getId() : null)
                .homeLocationName(effectiveHomeLocation != null ? effectiveHomeLocation.getRoomName() : null)
                .specs(includeSpecs ? asset.getSpecs() : null)
                .purchasePrice(asset.getPurchasePrice())
                .purchaseDate(asset.getPurchaseDate())
                .warrantyExpirationDate(asset.getWarrantyExpirationDate())
                .expiryTrackingEnabled(isConsumableMode(normalizedTrackingMode) ? isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled()) : null)
                .expirationDate(isConsumableMode(normalizedTrackingMode) ? asset.getExpirationDate() : null)
                .quantityOnHand(asset.getQuantityOnHand())
                .minimumStock(asset.getMinimumStock())
                .unit(asset.getUnit())
                .supplierId(asset.getSupplier() != null ? asset.getSupplier().getId() : null)
                .supplierName(asset.getSupplier() != null ? asset.getSupplier().getName() : null)
                .supplierAddress(asset.getSupplier() != null ? asset.getSupplier().getAddress() : null)
                .supplierPhoneNumber(asset.getSupplier() != null ? asset.getSupplier().getPhoneNumber() : null)
                .receiptLots(isConsumableMode(normalizedTrackingMode) ? mapToConsumableReceiptLotResponses(asset.getQaCode()) : null)
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
        String normalizedTrackingMode = normalizeTrackingMode(item.getTrackingMode());
        return AssetResponse.builder()
                .qaCode(item.getQaCode())
                .trackingMode(normalizedTrackingMode)
                .name(item.getName())
                .categoryId(item.getCategoryId())
                .category(item.getCategoryName())
                .status(isConsumableMode(normalizedTrackingMode) ? computeConsumableStatus(item.getQuantityOnHand(), item.getMinimumStock()) : item.getStatus())
                .locationId(item.getLocationId())
                .locationName(item.getLocationName())
                .homeLocationId(item.getHomeLocationId())
                .homeLocationName(item.getHomeLocationName())
                .purchasePrice(item.getPurchasePrice())
                .expiryTrackingEnabled(isConsumableMode(normalizedTrackingMode) ? isExpiryTrackingEnabled(item.getExpiryTrackingEnabled()) : null)
                .expirationDate(isConsumableMode(normalizedTrackingMode) ? item.getExpirationDate() : null)
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
        if (request.getLocationId() == null && isItemizedMode(trackingMode)) {
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

    private Location getConsumableStorageLocationOrThrow() {
        return locationRepository.findFirstByRoomNameIgnoreCase(DEFAULT_CONSUMABLE_STORAGE_ROOM)
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng lưu trữ mặc định '" + DEFAULT_CONSUMABLE_STORAGE_ROOM + "'."));
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
        if (safeInteger(request.getQuantityOnHand()) > 0) {
            if (request.getPurchasePrice() == null || request.getPurchasePrice().signum() <= 0) {
                throw new CustomException("Vui lòng nhập đơn giá hợp lệ cho lô khởi tạo ban đầu.");
            }
            if (request.getPurchaseDate() == null) {
                throw new CustomException("Vui lòng nhập ngày nhập kho ban đầu cho lô khởi tạo.");
            }
        }
        validateConsumableExpiry(
                isExpiryTrackingEnabled(request.getExpiryTrackingEnabled()),
                request.getExpirationDate(),
                request.getPurchaseDate()
        );
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
        if (safeQuantity <= safeMinimum) {
            return "Cần nhập";
        }
        return "Còn hàng";
    }

    private int safeInteger(Integer value) {
        return value == null ? 0 : value;
    }

    private boolean isExpiryTrackingEnabled(Boolean value) {
        return Boolean.TRUE.equals(value);
    }

    private LocalDate normalizeConsumableExpirationDate(
            boolean expiryTrackingEnabled,
            LocalDate expirationDate,
            LocalDate purchaseDate
    ) {
        if (!expiryTrackingEnabled) {
            return null;
        }
        validateConsumableExpiry(true, expirationDate, purchaseDate);
        return expirationDate;
    }

    private void validateConsumableExpiry(
            boolean expiryTrackingEnabled,
            LocalDate expirationDate,
            LocalDate purchaseDate
    ) {
        if (!expiryTrackingEnabled) {
            return;
        }
        if (expirationDate == null) {
            throw new CustomException("Vui lòng nhập hạn sử dụng khi bật quản lý hạn sử dụng.");
        }
        if (purchaseDate != null && expirationDate.isBefore(purchaseDate)) {
            throw new CustomException("Hạn sử dụng phải sau hoặc bằng ngày nhập kho ban đầu.");
        }
    }

    private void validateConsumableExpirySettingChange(String qaCode, boolean expiryTrackingEnabled) {
        if (!StringUtils.hasText(qaCode)) {
            return;
        }
        if (expiryTrackingEnabled
                && consumableReceiptLotRepository.existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNull(qaCode, 0)) {
            throw new CustomException("Không thể bật quản lý hạn sử dụng khi vẫn còn lô tồn chưa có hạn dùng.");
        }
        if (!expiryTrackingEnabled
                && consumableReceiptLotRepository.existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNotNull(qaCode, 0)) {
            throw new CustomException("Không thể tắt quản lý hạn sử dụng khi vẫn còn lô tồn có hạn dùng.");
        }
    }

    private int safePositiveInteger(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new CustomException(message);
        }
        return value;
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

    private BigDecimal updatedUnitPrice(Asset asset) {
        return asset != null ? asset.getPurchasePrice() : null;
    }

    private BigDecimal calculateAverageUnitPrice(
            BigDecimal currentAveragePrice,
            int currentQuantity,
            BigDecimal receiptUnitPrice,
            int receiptQuantity
    ) {
        if (receiptUnitPrice == null || receiptUnitPrice.signum() <= 0 || receiptQuantity <= 0) {
            return currentAveragePrice;
        }
        if (currentQuantity <= 0 || currentAveragePrice == null || currentAveragePrice.signum() <= 0) {
            return receiptUnitPrice.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal currentValue = currentAveragePrice.multiply(BigDecimal.valueOf(currentQuantity));
        BigDecimal receiptValue = receiptUnitPrice.multiply(BigDecimal.valueOf(receiptQuantity));
        int totalQuantity = currentQuantity + receiptQuantity;
        if (totalQuantity <= 0) {
            return receiptUnitPrice.setScale(2, RoundingMode.HALF_UP);
        }
        return currentValue.add(receiptValue)
                .divide(BigDecimal.valueOf(totalQuantity), 2, RoundingMode.HALF_UP);
    }

    private void createConsumableReceiptLot(
            Asset asset,
            Supplier supplier,
            int quantity,
            BigDecimal unitPrice,
            LocalDate receivedDate,
            LocalDate expirationDate,
            String lotCode,
            String note,
            AppUser actor
    ) {
        if (asset == null || quantity <= 0) {
            return;
        }
        if (unitPrice == null || unitPrice.signum() <= 0) {
            throw new CustomException("Đơn giá lô nhập phải lớn hơn 0.");
        }
        LocalDate normalizedReceivedDate = receivedDate != null ? receivedDate : LocalDate.now();
        if (expirationDate != null && expirationDate.isBefore(normalizedReceivedDate)) {
            throw new CustomException("Hạn sử dụng phải sau hoặc bằng ngày nhập lô.");
        }
        ConsumableReceiptLot lot = ConsumableReceiptLot.builder()
                .asset(asset)
                .supplier(supplier)
                .quantityReceived(quantity)
                .quantityRemaining(quantity)
                .unitPrice(unitPrice.setScale(2, RoundingMode.HALF_UP))
                .receivedDate(normalizedReceivedDate)
                .expirationDate(expirationDate)
                .lotCode(normalizeLotCode(lotCode))
                .note(StringUtils.hasText(note) ? note.trim() : null)
                .receivedBy(actor)
                .receivedAt(LocalDateTime.now())
                .build();
        consumableReceiptLotRepository.save(lot);
    }

    private LocalDate normalizeReceiptExpirationDate(Asset asset, ConsumableStockReceiptRequest request) {
        if (request == null) {
            return null;
        }
        boolean expiryTrackingEnabled = isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled());
        if (!expiryTrackingEnabled) {
            return null;
        }
        if (request.getExpirationDate() == null) {
            throw new CustomException("Vui lòng nhập hạn sử dụng cho lô hàng này.");
        }
        if (request.getReceivedDate() != null && request.getExpirationDate().isBefore(request.getReceivedDate())) {
            throw new CustomException("Hạn sử dụng phải sau hoặc bằng ngày nhập lô.");
        }
        return request.getExpirationDate();
    }

    private void refreshConsumableExpirySummary(Asset asset) {
        if (asset == null || !StringUtils.hasText(asset.getQaCode())) {
            return;
        }
        if (!isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled())) {
            asset.setExpirationDate(null);
            return;
        }
        LocalDate nearestExpirationDate = consumableReceiptLotRepository
                .findByAssetQaCodeAndQuantityRemainingGreaterThan(asset.getQaCode(), 0)
                .stream()
                .map(ConsumableReceiptLot::getExpirationDate)
                .filter(expirationDate -> expirationDate != null)
                .min(LocalDate::compareTo)
                .orElse(null);
        asset.setExpirationDate(nearestExpirationDate);
    }

    private List<LotAllocation> allocateConsumableLots(Asset asset, int quantityRequested) {
        List<ConsumableReceiptLot> availableLots = consumableReceiptLotRepository
                .findByAssetQaCodeAndQuantityRemainingGreaterThan(asset.getQaCode(), 0)
                .stream()
                .sorted(buildLotAllocationComparator(isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled())))
                .toList();
        if (availableLots.isEmpty()) {
            throw new CustomException("Không tìm thấy lô hàng còn tồn để cấp phát.");
        }
        int remainingQuantity = quantityRequested;
        List<LotAllocation> allocations = new java.util.ArrayList<>();
        for (ConsumableReceiptLot lot : availableLots) {
            if (remainingQuantity <= 0) {
                break;
            }
            int allocatable = Math.min(safeInteger(lot.getQuantityRemaining()), remainingQuantity);
            if (allocatable <= 0) {
                continue;
            }
            lot.setQuantityRemaining(safeInteger(lot.getQuantityRemaining()) - allocatable);
            allocations.add(new LotAllocation(lot, allocatable));
            remainingQuantity -= allocatable;
        }
        if (remainingQuantity > 0) {
            throw new CustomException("Số lượng tồn theo từng lô không đủ để cấp phát.");
        }
        return allocations;
    }

    private Comparator<ConsumableReceiptLot> buildLotAllocationComparator(boolean expiryTrackingEnabled) {
        if (expiryTrackingEnabled) {
            return Comparator.comparing(
                            ConsumableReceiptLot::getExpirationDate,
                            Comparator.nullsLast(LocalDate::compareTo)
                    )
                    .thenComparing(ConsumableReceiptLot::getReceivedDate, Comparator.nullsLast(LocalDate::compareTo))
                    .thenComparing(ConsumableReceiptLot::getId, Comparator.nullsLast(Long::compareTo));
        }
        return Comparator.comparing(ConsumableReceiptLot::getReceivedDate, Comparator.nullsLast(LocalDate::compareTo))
                .thenComparing(ConsumableReceiptLot::getId, Comparator.nullsLast(Long::compareTo));
    }

    private BigDecimal calculateAllocatedUnitPrice(List<LotAllocation> allocations, int issuedQuantity) {
        if (allocations == null || allocations.isEmpty() || issuedQuantity <= 0) {
            return updatedUnitPrice(null);
        }
        BigDecimal total = allocations.stream()
                .map(allocation -> allocation.lot().getUnitPrice().multiply(BigDecimal.valueOf(allocation.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.divide(BigDecimal.valueOf(issuedQuantity), 2, RoundingMode.HALF_UP);
    }

    private String appendLotAllocationNote(String baseNote, List<LotAllocation> allocations) {
        String trimmedBaseNote = StringUtils.hasText(baseNote) ? baseNote.trim() : null;
        if (allocations == null || allocations.isEmpty()) {
            return trimmedBaseNote;
        }
        String allocationSummary = allocations.stream()
                .map(allocation -> {
                    ConsumableReceiptLot lot = allocation.lot();
                    StringBuilder builder = new StringBuilder();
                    builder.append(StringUtils.hasText(lot.getLotCode()) ? lot.getLotCode().trim() : "Lô #" + lot.getId());
                    builder.append(": ").append(allocation.quantity());
                    if (lot.getExpirationDate() != null) {
                        builder.append(" (HSD ").append(lot.getExpirationDate()).append(")");
                    }
                    return builder.toString();
                })
                .reduce((left, right) -> left + "; " + right)
                .orElse("");
        if (!StringUtils.hasText(trimmedBaseNote)) {
            return "Phân bổ theo lô: " + allocationSummary;
        }
        return trimmedBaseNote + " | Phân bổ theo lô: " + allocationSummary;
    }

    private String normalizeLotCode(String lotCode) {
        return StringUtils.hasText(lotCode) ? lotCode.trim() : null;
    }

    private List<ConsumableReceiptLotResponse> mapToConsumableReceiptLotResponses(String qaCode) {
        return consumableReceiptLotRepository.findByAssetQaCodeOrderByReceivedDateDescIdDesc(qaCode).stream()
                .map(this::mapToConsumableReceiptLotResponse)
                .toList();
    }

    private ConsumableReceiptLotResponse mapToConsumableReceiptLotResponse(ConsumableReceiptLot lot) {
        AppUser receivedBy = lot.getReceivedBy();
        Supplier supplier = lot.getSupplier();
        return ConsumableReceiptLotResponse.builder()
                .id(lot.getId())
                .lotCode(lot.getLotCode())
                .quantityReceived(lot.getQuantityReceived())
                .quantityRemaining(lot.getQuantityRemaining())
                .unitPrice(lot.getUnitPrice())
                .receivedDate(lot.getReceivedDate())
                .expirationDate(lot.getExpirationDate())
                .supplierId(supplier != null ? supplier.getId() : null)
                .supplierName(supplier != null ? supplier.getName() : null)
                .receivedAt(lot.getReceivedAt())
                .receivedByUserId(receivedBy != null ? receivedBy.getId() : null)
                .receivedByUsername(receivedBy != null ? receivedBy.getUsername() : null)
                .receivedByFullName(receivedBy != null ? receivedBy.getFullName() : null)
                .note(lot.getNote())
                .build();
    }

    private void upsertConsumableLocationStock(
            Asset asset,
            Location location,
            Integer issuedQuantity,
            BigDecimal unitPrice,
            LocalDateTime issuedAt,
            AppUser actor,
            String note
    ) {
        ConsumableLocationStock stock = consumableLocationStockRepository
                .findFirstByAssetQaCodeAndLocationId(asset.getQaCode(), location.getId())
                .orElseGet(() -> ConsumableLocationStock.builder()
                        .asset(asset)
                        .location(location)
                        .quantityIssued(0)
                        .quantityRemaining(0)
                        .build());
        int quantity = safeInteger(issuedQuantity);
        stock.setQuantityIssued(safeInteger(stock.getQuantityIssued()) + quantity);
        stock.setQuantityRemaining(safeInteger(stock.getQuantityRemaining()) + quantity);
        stock.setUnitPrice(unitPrice);
        stock.setLastIssuedAt(issuedAt);
        stock.setLastUpdatedAt(issuedAt);
        stock.setLastUpdatedBy(actor);
        stock.setLastNote(StringUtils.hasText(note) ? note.trim() : null);
        consumableLocationStockRepository.save(stock);
    }

    private ConsumableLocationStockResponse mapToConsumableLocationStockResponse(ConsumableLocationStock stock) {
        int quantityIssued = safeInteger(stock.getQuantityIssued());
        int quantityRemaining = safeInteger(stock.getQuantityRemaining());
        BigDecimal unitPrice = stock.getUnitPrice();
        BigDecimal remainingValue = unitPrice == null ? null : unitPrice.multiply(BigDecimal.valueOf(quantityRemaining));
        AppUser lastUpdatedBy = stock.getLastUpdatedBy();
        return ConsumableLocationStockResponse.builder()
                .id(stock.getId())
                .assetQaCode(stock.getAsset().getQaCode())
                .assetName(stock.getAsset().getName())
                .categoryId(stock.getAsset().getCategory() != null ? stock.getAsset().getCategory().getId() : null)
                .categoryName(getCategoryDisplayName(stock.getAsset().getCategory()))
                .locationId(stock.getLocation().getId())
                .locationName(stock.getLocation().getRoomName())
                .quantityIssued(quantityIssued)
                .quantityRemaining(quantityRemaining)
                .quantityConsumed(Math.max(0, quantityIssued - quantityRemaining))
                .unit(stock.getAsset().getUnit())
                .expiryTrackingEnabled(isExpiryTrackingEnabled(stock.getAsset().getExpiryTrackingEnabled()))
                .expirationDate(stock.getAsset().getExpirationDate())
                .unitPrice(unitPrice)
                .remainingValue(remainingValue)
                .lastIssuedAt(stock.getLastIssuedAt())
                .lastUpdatedAt(stock.getLastUpdatedAt())
                .lastUpdatedByUserId(lastUpdatedBy != null ? lastUpdatedBy.getId() : null)
                .lastUpdatedByUsername(lastUpdatedBy != null ? lastUpdatedBy.getUsername() : null)
                .lastUpdatedByFullName(lastUpdatedBy != null ? lastUpdatedBy.getFullName() : null)
                .lastNote(stock.getLastNote())
                .build();
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
                "Vật tư cần nhập thêm",
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
                .unitPrice(issue.getUnitPrice())
                .note(issue.getNote())
                .issuedByUserId(issue.getIssuedBy().getId())
                .issuedByUsername(issue.getIssuedBy().getUsername())
                .issuedByFullName(issue.getIssuedBy().getFullName())
                .issuedAt(issue.getIssuedAt())
                .build();
    }

    private ConsumableRequestResponse mapToConsumableRequestResponse(ConsumableRequest request) {
        AppUser requestedBy = request.getRequestedBy();
        AppUser resolvedBy = request.getResolvedBy();
        return ConsumableRequestResponse.builder()
                .id(request.getId())
                .assetQaCode(request.getAsset().getQaCode())
                .assetName(request.getAsset().getName())
                .locationId(request.getLocation().getId())
                .locationName(request.getLocation().getRoomName())
                .quantityRequested(request.getQuantityRequested())
                .unit(request.getAsset().getUnit())
                .reason(request.getReason())
                .status(request.getStatus())
                .decisionNote(request.getDecisionNote())
                .createdAt(request.getCreatedAt())
                .resolvedAt(request.getResolvedAt())
                .requestedByUserId(requestedBy != null ? requestedBy.getId() : null)
                .requestedByUsername(requestedBy != null ? requestedBy.getUsername() : null)
                .requestedByFullName(requestedBy != null ? requestedBy.getFullName() : null)
                .resolvedByUserId(resolvedBy != null ? resolvedBy.getId() : null)
                .resolvedByUsername(resolvedBy != null ? resolvedBy.getUsername() : null)
                .resolvedByFullName(resolvedBy != null ? resolvedBy.getFullName() : null)
                .build();
    }

    private String buildConsumableRequestIssueNote(ConsumableRequest request, String decisionNote) {
        StringBuilder builder = new StringBuilder();
        builder.append("Cấp phát theo phiếu yêu cầu #").append(request.getId())
                .append(". Lý do: ").append(request.getReason());
        if (StringUtils.hasText(decisionNote)) {
            builder.append(" Ghi chú duyệt: ").append(decisionNote.trim());
        }
        return builder.toString();
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

    private record LotAllocation(ConsumableReceiptLot lot, int quantity) {
    }
}
