package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetAdminListItemResponse;
import com.poly.mhv.dto.asset.ConsumableDisposalRequestCreateRequest;
import com.poly.mhv.dto.asset.ConsumableDisposalRequestItemCreateRequest;
import com.poly.mhv.dto.asset.ConsumableDisposalRequestItemResponse;
import com.poly.mhv.dto.asset.ConsumableDisposalRequestResponse;
import com.poly.mhv.dto.asset.ConsumableReceiptLotResponse;
import com.poly.mhv.dto.asset.ConsumableLocationOverviewResponse;
import com.poly.mhv.dto.asset.ConsumableLocationRemainingUpdateRequest;
import com.poly.mhv.dto.asset.ConsumableLocationStockResponse;
import com.poly.mhv.dto.asset.ConsumableIssueRequest;
import com.poly.mhv.dto.asset.ConsumableIssueResponse;
import com.poly.mhv.dto.asset.ConsumableInventorySummaryResponse;
import com.poly.mhv.dto.asset.ConsumableRequestCreateRequest;
import com.poly.mhv.dto.asset.ConsumableRequestDecisionRequest;
import com.poly.mhv.dto.asset.ConsumableRequestResponse;
import com.poly.mhv.dto.asset.ConsumableStockReceiptRequest;
import com.poly.mhv.dto.asset.ConsumableWarehouseOverviewResponse;
import com.poly.mhv.dto.asset.ConsumableWarehouseStockResponse;
import com.poly.mhv.dto.asset.ConsumableWarehouseTransferRequest;
import com.poly.mhv.dto.asset.ConsumableWarehouseTransferResponse;
import com.poly.mhv.dto.asset.ExpiredConsumableLotResponse;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ConsumableDisposalRequest;
import com.poly.mhv.entity.ConsumableDisposalRequestItem;
import com.poly.mhv.entity.ConsumableIssue;
import com.poly.mhv.entity.ConsumableLocationStock;
import com.poly.mhv.entity.ConsumableReceiptLot;
import com.poly.mhv.entity.ConsumableRequest;
import com.poly.mhv.entity.ConsumableWarehouseTransfer;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.exception.ResourceNotFoundException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.ConsumableDisposalRequestItemRepository;
import com.poly.mhv.repository.ConsumableDisposalRequestRepository;
import com.poly.mhv.repository.ConsumableIssueRepository;
import com.poly.mhv.repository.ConsumableInquiryFulfillmentRepository;
import com.poly.mhv.repository.ConsumableLocationStockRepository;
import com.poly.mhv.repository.ConsumableReceiptLotRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.ConsumableWarehouseTransferRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.SupplierRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.util.AssetStatusSupport;
import com.poly.mhv.util.TicketStatusSupport;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.util.QRCodeGenerator;
import com.poly.mhv.util.UtcDateTimes;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.JpaSort;
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
    private static final String QUANTITY_UNIT_RETAIL = "RETAIL";
    private static final String QUANTITY_UNIT_WHOLESALE = "WHOLESALE";
    private static final String ASSET_CREATED_AT_SORT_EXPRESSION = """
            (select max(assetCreateNotification.occurredAt)
             from Notification assetCreateNotification
             where assetCreateNotification.eventType = 'ASSET_CREATE'
               and assetCreateNotification.assetQaCode = a.qaCode)
            """.replaceAll("\\s+", " ").trim();
    private static final String ASSET_CREATED_AT_MISSING_SORT_EXPRESSION =
            "case when " + ASSET_CREATED_AT_SORT_EXPRESSION + " is null then 1 else 0 end";

    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final CategoryRepository categoryRepository;
    private final ConsumableIssueRepository consumableIssueRepository;
    private final ConsumableLocationStockRepository consumableLocationStockRepository;
    private final ConsumableReceiptLotRepository consumableReceiptLotRepository;
    private final ConsumableRequestRepository consumableRequestRepository;
    private final ConsumableInquiryFulfillmentRepository consumableInquiryFulfillmentRepository;
    private final ConsumableWarehouseTransferRepository consumableWarehouseTransferRepository;
    private final ConsumableDisposalRequestItemRepository consumableDisposalRequestItemRepository;
    private final ConsumableDisposalRequestRepository consumableDisposalRequestRepository;
    private final LocationRepository locationRepository;
    private final SupplierRepository supplierRepository;
    private final TicketRepository ticketRepository;
    private final QRCodeGenerator qrCodeGenerator;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final Map<String, CachedAssetResponse> assetDetailCache = new ConcurrentHashMap<>();
    private final Map<String, CachedAssetQr> assetQrCache = new ConcurrentHashMap<>();

    public AssetService(
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            AreaTypeCatalogRepository areaTypeCatalogRepository,
            CategoryRepository categoryRepository,
            ConsumableIssueRepository consumableIssueRepository,
            ConsumableLocationStockRepository consumableLocationStockRepository,
            ConsumableReceiptLotRepository consumableReceiptLotRepository,
            ConsumableRequestRepository consumableRequestRepository,
            ConsumableInquiryFulfillmentRepository consumableInquiryFulfillmentRepository,
            ConsumableWarehouseTransferRepository consumableWarehouseTransferRepository,
            ConsumableDisposalRequestItemRepository consumableDisposalRequestItemRepository,
            ConsumableDisposalRequestRepository consumableDisposalRequestRepository,
            LocationRepository locationRepository,
            SupplierRepository supplierRepository,
            TicketRepository ticketRepository,
            QRCodeGenerator qrCodeGenerator,
            NotificationService notificationService,
            ObjectMapper objectMapper
    ) {
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.areaTypeCatalogRepository = areaTypeCatalogRepository;
        this.categoryRepository = categoryRepository;
        this.consumableIssueRepository = consumableIssueRepository;
        this.consumableLocationStockRepository = consumableLocationStockRepository;
        this.consumableReceiptLotRepository = consumableReceiptLotRepository;
        this.consumableRequestRepository = consumableRequestRepository;
        this.consumableInquiryFulfillmentRepository = consumableInquiryFulfillmentRepository;
        this.consumableWarehouseTransferRepository = consumableWarehouseTransferRepository;
        this.consumableDisposalRequestItemRepository = consumableDisposalRequestItemRepository;
        this.consumableDisposalRequestRepository = consumableDisposalRequestRepository;
        this.locationRepository = locationRepository;
        this.supplierRepository = supplierRepository;
        this.ticketRepository = ticketRepository;
        this.qrCodeGenerator = qrCodeGenerator;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AssetResponse createAsset(AssetCreateRequest request) {
        String trackingMode = normalizeTrackingMode(request != null ? request.getTrackingMode() : null);
        validateCreateRequest(request, trackingMode);
        if (request == null) {
            throw new CustomException("Dữ liệu tạo thiết bị không được để trống.");
        }
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
        validateCategoryCompatibility(category, trackingMode);
        Supplier supplier = request.getSupplierId() == null ? null : getSupplierOrThrow(request.getSupplierId());
        String generatedQaCode = generateQaCode(category);

        boolean consumable = isConsumableMode(trackingMode);
        boolean expiryTrackingEnabled = consumable && isExpiryTrackingEnabled(request.getExpiryTrackingEnabled());
        String retailUnit = consumable ? normalizeRetailUnit(request.getRetailUnit(), request.getUnit()) : null;
        String wholesaleUnit = consumable ? normalizeWholesaleUnit(request.getWholesaleUnit()) : null;
        Integer wholesaleToRetailFactor = consumable ? normalizeWholesaleToRetailFactor(request.getWholesaleToRetailFactor()) : null;
        Asset conversionAsset = consumable
                ? Asset.builder()
                .retailUnit(retailUnit)
                .wholesaleUnit(wholesaleUnit)
                .wholesaleToRetailFactor(wholesaleToRetailFactor)
                .build()
                : null;
        String initialQuantityUnit = consumable ? normalizeQuantityUnit(request.getQuantityOnHandUnit()) : QUANTITY_UNIT_RETAIL;
        String minimumStockUnit = consumable ? normalizeQuantityUnit(request.getMinimumStockUnit()) : QUANTITY_UNIT_RETAIL;
        Integer initialQuantityOnHand = consumable
                ? convertToRetailQuantityAllowZero(conversionAsset, safeInteger(request.getQuantityOnHand()), initialQuantityUnit)
                : null;
        Integer normalizedMinimumStock = consumable
                ? convertToRetailQuantityAllowZero(conversionAsset, safeInteger(request.getMinimumStock()), minimumStockUnit)
                : null;
        BigDecimal normalizedInitialPurchasePrice = consumable && request.getPurchasePrice() != null
                ? normalizeRetailUnitPrice(conversionAsset, request.getPurchasePrice(), initialQuantityUnit)
                : request.getPurchasePrice();
        String initialTechnicalStatus = consumable ? null : normalizeRequestedTechnicalStatus(request.getTechnicalStatus(), request.getStatus());
        String initialUsageStatus = consumable
                ? null
                : normalizeRequestedUsageStatus(request.getUsageStatus(), request.getStatus());
        Location homeLocation = consumable
                ? getConsumableWarehouseLocationOrThrow(request.getLocationId(), "Không tìm thấy kho lưu trữ với id: " + request.getLocationId())
                : getAssetStorageLocationOrThrow(request.getLocationId(), "Không tìm thấy phòng với id: " + request.getLocationId());
        Location currentLocation = consumable
                ? homeLocation
                : resolveCurrentLocation(request.getCurrentLocationId(), homeLocation);
        Asset asset = Asset.builder()
                .qaCode(generatedQaCode)
                .trackingMode(trackingMode)
                .name(request.getName())
                .category(category)
                .status(consumable
                        ? computeConsumableStatus(initialQuantityOnHand, normalizedMinimumStock)
                        : AssetStatusSupport.deriveLegacyStatus(initialTechnicalStatus, initialUsageStatus, false))
                .technicalStatus(initialTechnicalStatus)
                .usageStatus(initialUsageStatus)
                .location(currentLocation)
                .homeLocation(homeLocation)
                .specs(normalizeSpecs(request.getSpecs()))
                .purchasePrice(normalizedInitialPurchasePrice)
                .purchaseDate(request.getPurchaseDate())
                .warrantyExpirationDate(consumable ? null : request.getWarrantyExpirationDate())
                .expiryTrackingEnabled(consumable ? expiryTrackingEnabled : null)
                .expirationDate(consumable ? normalizeConsumableExpirationDate(
                        expiryTrackingEnabled,
                        request.getExpirationDate(),
                        request.getPurchaseDate()
                ) : null)
                .quantityOnHand(initialQuantityOnHand)
                .minimumStock(normalizedMinimumStock)
                .unit(consumable ? retailUnit : null)
                .retailUnit(retailUnit)
                .wholesaleUnit(wholesaleUnit)
                .wholesaleToRetailFactor(wholesaleToRetailFactor)
                .supplier(supplier)
                .build();
        AppUser actor = getCurrentUser();
        Asset saved = assetRepository.save(asset);
        if (consumable && safeInteger(saved.getQuantityOnHand()) > 0) {
            createConsumableReceiptLot(
                    saved,
                    supplier,
                    homeLocation,
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
                ),
                isConsumableMode(saved.getTrackingMode())
                        ? consumableNotificationTargets(null, null)
                        : adminNotificationTargets("/admin/assets")
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
            String technicalStatus,
            String usageStatus,
            String trackingMode,
            Integer categoryId,
            Integer locationId,
            String sortKey,
            String sortDirection
    ) {
        String normalizedName = StringUtils.hasText(name) ? name.trim() : null;
        String normalizedStatus = normalizeAssetFilterStatus(status);
        String normalizedTechnicalStatus = normalizeOptionalTechnicalStatusFilter(technicalStatus);
        String normalizedUsageStatus = normalizeOptionalUsageStatusFilter(usageStatus);
        String normalizedTrackingMode = StringUtils.hasText(trackingMode) ? normalizeTrackingMode(trackingMode) : null;
        PageRequest pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(size, 100)),
                buildSort(sortKey, sortDirection)
        );
        Page<AssetAdminListItemResponse> assetPage = assetRepository.searchForAdmin(
                normalizedName,
                normalizedStatus,
                normalizedTechnicalStatus,
                normalizedUsageStatus,
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
    public ConsumableInventorySummaryResponse getConsumableInventorySummary(
            String name,
            Integer categoryId,
            Integer locationId
    ) {
        String normalizedName = StringUtils.hasText(name) ? name.trim() : null;
        BigDecimal totalInventoryValue = consumableReceiptLotRepository.sumOpenLotInventoryValueForInventorySummary(
                normalizedName,
                categoryId,
                locationId
        );
        return ConsumableInventorySummaryResponse.builder()
                .totalConsumables(assetRepository.countConsumablesForInventorySummary(normalizedName, categoryId, locationId))
                .healthyConsumables(assetRepository.countHealthyConsumablesForInventorySummary(normalizedName, categoryId, locationId))
                .lowStockConsumables(assetRepository.countLowStockConsumablesForInventorySummary(normalizedName, categoryId, locationId))
                .expiredLots(consumableReceiptLotRepository.countExpiredOpenLotsForInventorySummary(
                        LocalDate.now(),
                        normalizedName,
                        categoryId,
                        locationId
                ))
                .totalInventoryValue(totalInventoryValue != null ? totalInventoryValue : BigDecimal.ZERO)
                .build();
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
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thiết bị với mã: " + qaCode));
        String oldName = asset.getName();
        String oldCategory = getCategoryDisplayName(asset.getCategory());
        String oldStatus = isItemizedMode(asset.getTrackingMode()) ? getItemizedDisplayStatus(asset) : asset.getStatus();
        String oldHome = asset.getHomeLocation().getRoomName();
        String oldCurrent = asset.getLocation().getRoomName();
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
        if (isItemizedMode(trackingMode)) {
            ensureItemizedStatusesInitialized(asset);
            ensureTicketControlledStatusIsNotOverridden(asset, request);
            applyItemizedStatusUpdate(asset, request);
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + request.getCategoryId()));
            validateCategoryCompatibility(category, trackingMode);
            asset.setCategory(category);
        }
        if (isItemizedMode(trackingMode) && request.getLocationId() != null) {
            Location homeLocation = getAssetStorageLocationOrThrow(
                    request.getLocationId(),
                    "Không tìm thấy phòng với id: " + request.getLocationId()
            );
            asset.setHomeLocation(homeLocation);
            if (request.getCurrentLocationId() == null && oldCurrent.equals(oldHome)) {
                asset.setLocation(homeLocation);
            }
        }
        if (isItemizedMode(trackingMode) && request.getCurrentLocationId() != null) {
            Location currentLocation = getAssetStorageLocationOrThrow(
                    request.getCurrentLocationId(),
                    "Không tìm thấy phòng hiện tại với id: " + request.getCurrentLocationId()
            );
            asset.setLocation(currentLocation);
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
            String resolvedRetailUnit = normalizeRetailUnit(
                    firstNonBlank(request.getRetailUnit(), asset.getRetailUnit()),
                    firstNonBlank(request.getUnit(), asset.getUnit())
            );
            String resolvedWholesaleUnit = normalizeWholesaleUnit(
                    firstNonBlank(request.getWholesaleUnit(), asset.getWholesaleUnit())
            );
            Integer resolvedWholesaleToRetailFactor = normalizeWholesaleToRetailFactor(
                    request.getWholesaleToRetailFactor() != null
                            ? request.getWholesaleToRetailFactor()
                            : asset.getWholesaleToRetailFactor()
            );
            Asset conversionAsset = Asset.builder()
                    .retailUnit(resolvedRetailUnit)
                    .wholesaleUnit(resolvedWholesaleUnit)
                    .wholesaleToRetailFactor(resolvedWholesaleToRetailFactor)
                    .build();
            if (request.getLocationId() != null) {
                Location storageLocation = getConsumableWarehouseLocationOrThrow(
                        request.getLocationId(),
                        "Không tìm thấy kho lưu trữ với id: " + request.getLocationId()
                );
                asset.setLocation(storageLocation);
                asset.setHomeLocation(storageLocation);
            }
            if (request.getQuantityOnHand() != null) {
                if (!request.getQuantityOnHand().equals(asset.getQuantityOnHand())) {
                    throw new CustomException("Tồn kho tổng được quản lý theo từng lô nhập. Vui lòng dùng chức năng nhập hàng để cập nhật.");
                }
                asset.setQuantityOnHand(request.getQuantityOnHand());
            }
            if (request.getMinimumStock() != null) {
                asset.setMinimumStock(convertToRetailQuantityAllowZero(
                        conversionAsset,
                        request.getMinimumStock(),
                        normalizeQuantityUnit(request.getMinimumStockUnit())
                ));
            }
            if (request.getUnit() != null) {
                asset.setUnit(normalizeRetailUnit(null, request.getUnit()));
            }
            if (request.getRetailUnit() != null || request.getWholesaleUnit() != null || request.getWholesaleToRetailFactor() != null || request.getUnit() != null) {
                asset.setRetailUnit(resolvedRetailUnit);
                asset.setWholesaleUnit(resolvedWholesaleUnit);
                asset.setWholesaleToRetailFactor(resolvedWholesaleToRetailFactor);
            }
            if (request.getExpiryTrackingEnabled() != null) {
                boolean expiryTrackingEnabled = isExpiryTrackingEnabled(request.getExpiryTrackingEnabled());
                validateConsumableExpirySettingChange(asset.getQaCode(), expiryTrackingEnabled);
                asset.setExpiryTrackingEnabled(expiryTrackingEnabled);
            }
            if (isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled())) {
                if (request.getExpirationDate() != null) {
                    validateConsumableExpiry(true, request.getExpirationDate(), asset.getPurchaseDate());
                    syncInitialConsumableLotExpiration(asset, request.getExpirationDate());
                }
            } else {
                asset.setExpirationDate(null);
            }
            validateConsumableState(asset);
            asset.setWarrantyExpirationDate(null);
            refreshConsumableExpirySummary(asset);
            asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        } else {
            asset.setExpiryTrackingEnabled(null);
            asset.setExpirationDate(null);
            validatePurchaseInfo(asset.getPurchasePrice(), asset.getPurchaseDate(), asset.getWarrantyExpirationDate());
            syncItemizedLegacyStatus(asset, shouldPreserveRepairStatus(asset));
        }
        Asset updated = assetRepository.save(asset);
        AppUser actor = getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "ASSET_UPDATE",
                isConsumableMode(trackingMode) ? "Cập nhật vật tư tiêu hao" : "Cập nhật thiết bị",
                actorDisplayName + " đã " + (isConsumableMode(trackingMode) ? "chỉnh sửa vật tư " : "chỉnh sửa thiết bị ")
                        + updated.getName() + ".",
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
                        Map.entry("Trạng thái mới", isItemizedMode(trackingMode) ? getItemizedDisplayStatus(updated) : updated.getStatus()),
                        Map.entry("Phòng gốc cũ", oldHome),
                        Map.entry("Phòng gốc mới", updated.getHomeLocation().getRoomName()),
                        Map.entry("Người thực hiện", actorDisplayName)
                ),
                isConsumableMode(trackingMode)
                        ? consumableNotificationTargets(null, null)
                        : adminNotificationTargets("/admin/assets")
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
        if (request.getSourceWarehouseLocationId() == null) {
            throw new CustomException("sourceWarehouseLocationId là bắt buộc.");
        }
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new CustomException("quantity phải lớn hơn 0.");
        }
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        if (currentQuantity < request.getQuantity()) {
            throw new CustomException("Số lượng tồn không đủ để cấp phát.");
        }
        Location issuedToLocation = getAssetStorageLocationOrThrow(
                request.getIssuedToLocationId(),
                "Không tìm thấy phòng nhận với id: " + request.getIssuedToLocationId()
        );
        Location sourceWarehouseLocation = getConsumableWarehouseLocationOrThrow(
                request.getSourceWarehouseLocationId(),
                "Không tìm thấy kho xuất với id: " + request.getSourceWarehouseLocationId()
        );
        AppUser actor = getCurrentUser();
        LocalDateTime now = UtcDateTimes.now();
        List<LotAllocation> allocations = allocateConsumableLots(asset, sourceWarehouseLocation, request.getQuantity());
        BigDecimal unitPrice = calculateAllocatedUnitPrice(allocations, request.getQuantity());
        String issueNote = appendLotAllocationNote(request.getNote(), allocations);

        recalculateConsumableQuantityOnHand(asset);
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        consumableReceiptLotRepository.saveAll(allocations.stream().map(LotAllocation::lot).toList());

        ConsumableIssue issue = ConsumableIssue.builder()
                .asset(updated)
                .issuedToLocation(issuedToLocation)
                .sourceWarehouseLocation(sourceWarehouseLocation)
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
                actorDisplayName + " đã cấp phát " + formatConsumableQuantity(updated, request.getQuantity())
                        + " " + updated.getName() + " từ kho " + sourceWarehouseLocation.getRoomName()
                        + " cho phòng " + issuedToLocation.getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Số lượng cấp phát", formatConsumableQuantity(updated, request.getQuantity()),
                        "Đơn vị tính", safeUnit(updated),
                        "Kho xuất", sourceWarehouseLocation.getRoomName(),
                        "Phòng nhận", issuedToLocation.getRoomName(),
                        "Tồn còn lại", formatConsumableQuantity(updated, updated.getQuantityOnHand()),
                        "Người thực hiện", actorDisplayName
                ),
                consumableNotificationTargets(null, null)
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

        int receiptQuantityInput = safePositiveInteger(request.getQuantity(), "Số lượng nhập phải lớn hơn 0.");
        String receiptQuantityUnit = normalizeQuantityUnit(request.getQuantityUnit());
        int receiptQuantity = convertToRetailQuantity(asset, receiptQuantityInput, receiptQuantityUnit);
        if (request.getUnitPrice() == null || request.getUnitPrice().signum() <= 0) {
            throw new CustomException("Đơn giá nhập phải lớn hơn 0.");
        }
        Supplier supplier = getSupplierOrThrow(request.getSupplierId());
        Location warehouseLocation = getConsumableWarehouseLocationOrThrow(
                request.getWarehouseLocationId(),
                "Không tìm thấy kho nhập với id: " + request.getWarehouseLocationId()
        );
        BigDecimal averageUnitPrice = calculateAverageUnitPrice(
                asset.getPurchasePrice(),
                safeInteger(asset.getQuantityOnHand()),
                normalizeRetailUnitPrice(asset, request.getUnitPrice(), receiptQuantityUnit),
                receiptQuantity
        );
        AppUser actor = getCurrentUser();

        asset.setPurchasePrice(averageUnitPrice);
        asset.setSupplier(supplier);
        createConsumableReceiptLot(
                asset,
                supplier,
                warehouseLocation,
                receiptQuantity,
                normalizeRetailUnitPrice(asset, request.getUnitPrice(), receiptQuantityUnit),
                request.getReceivedDate(),
                normalizeReceiptExpirationDate(asset, request),
                request.getLotCode(),
                request.getNote(),
                actor
        );
        recalculateConsumableQuantityOnHand(asset);
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        invalidateAssetCaches(updated.getQaCode());

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_RECEIVED",
                "Nhập hàng vật tư",
                actorDisplayName + " đã nhập thêm " + formatConsumableQuantity(updated, receiptQuantity)
                        + " " + updated.getName() + " về kho " + warehouseLocation.getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Số lượng nhập", formatConsumableQuantity(updated, receiptQuantity),
                        "Đơn giá lô nhập", request.getUnitPrice(),
                        "Đơn giá trung bình", averageUnitPrice,
                        "Nhà cung cấp", supplier.getName(),
                        "Kho nhập", warehouseLocation.getRoomName(),
                        "Tồn sau nhập", formatConsumableQuantity(updated, updated.getQuantityOnHand()),
                        "Người thực hiện", actorDisplayName
                ),
                consumableNotificationTargets(null, null)
        );
        return mapToAssetResponse(updated, false, true);
    }

    @Transactional
    public ConsumableWarehouseTransferResponse transferConsumableBetweenWarehouses(
            String qaCode,
            ConsumableWarehouseTransferRequest request
    ) {
        Asset asset = assetRepository.findDetailByQaCode(qaCode)
                .orElseThrow(() -> new CustomException("Không tìm thấy tài sản với mã: " + qaCode));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Chỉ vật tư tiêu hao mới hỗ trợ chuyển kho nội bộ.");
        }
        if (request == null) {
            throw new CustomException("Dữ liệu chuyển kho không được để trống.");
        }
        int quantityTransferred = safePositiveInteger(request.getQuantity(), "Số lượng chuyển kho phải lớn hơn 0.");
        Location sourceWarehouse = getConsumableWarehouseLocationOrThrow(
                request.getSourceWarehouseLocationId(),
                "Không tìm thấy kho nguồn với id: " + request.getSourceWarehouseLocationId()
        );
        Location targetWarehouse = getConsumableWarehouseLocationOrThrow(
                request.getTargetWarehouseLocationId(),
                "Không tìm thấy kho đích với id: " + request.getTargetWarehouseLocationId()
        );
        if (sourceWarehouse.getId().equals(targetWarehouse.getId())) {
            throw new CustomException("Kho nguồn và kho đích phải khác nhau.");
        }

        AppUser actor = getCurrentUser();
        LocalDateTime now = UtcDateTimes.now();
        List<LotAllocation> allocations = allocateConsumableLots(asset, sourceWarehouse, quantityTransferred);
        BigDecimal unitPrice = calculateAllocatedUnitPrice(allocations, quantityTransferred);
        String transferNote = buildWarehouseTransferNote(request.getNote(), sourceWarehouse, targetWarehouse, allocations);

        for (LotAllocation allocation : allocations) {
            ConsumableReceiptLot sourceLot = allocation.lot();
            createConsumableReceiptLot(
                    asset,
                    sourceLot.getSupplier(),
                    targetWarehouse,
                    allocation.quantity(),
                    sourceLot.getUnitPrice(),
                    sourceLot.getReceivedDate(),
                    sourceLot.getExpirationDate(),
                    sourceLot.getLotCode(),
                    "Chuyển nội bộ từ kho " + sourceWarehouse.getRoomName() + " sang kho " + targetWarehouse.getRoomName()
                            + (StringUtils.hasText(request.getNote()) ? ". " + request.getNote().trim() : ""),
                    actor
            );
        }

        recalculateConsumableQuantityOnHand(asset); // Just to be safe
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        asset = assetRepository.save(asset);
        ConsumableWarehouseTransfer savedTransfer = consumableWarehouseTransferRepository.save(
                ConsumableWarehouseTransfer.builder()
                        .asset(asset)
                        .sourceWarehouseLocation(sourceWarehouse)
                        .targetWarehouseLocation(targetWarehouse)
                        .quantityTransferred(quantityTransferred)
                        .unitPrice(unitPrice)
                        .transferredAt(now)
                        .transferredBy(actor)
                        .note(transferNote)
                        .build()
        );
        notifyLowStockIfNeeded(asset, actor);

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_WAREHOUSE_TRANSFER",
                "Chuyển kho nội bộ vật tư",
                actorDisplayName + " đã chuyển " + formatConsumableQuantity(asset, quantityTransferred)
                        + " " + asset.getName() + " từ kho " + sourceWarehouse.getRoomName()
                        + " sang kho " + targetWarehouse.getRoomName() + ".",
                actor.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Vật tư", asset.getQaCode() + " - " + asset.getName(),
                        "Kho nguồn", sourceWarehouse.getRoomName(),
                        "Kho đích", targetWarehouse.getRoomName(),
                        "Số lượng chuyển", formatConsumableQuantity(asset, quantityTransferred),
                        "Đơn vị tính", safeUnit(asset),
                        "Người thực hiện", actorDisplayName
                ),
                consumableNotificationTargets(null, null)
        );
        return mapToConsumableWarehouseTransferResponse(savedTransfer);
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
        Location location = getAssetStorageLocationOrThrow(locationId, "Không tìm thấy phòng với id: " + locationId);
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
    public ConsumableLocationOverviewResponse getAllTrackableConsumableRoomsOverview() {
        return ConsumableLocationOverviewResponse.builder()
                .locationName("Tất cả phòng")
                .roomCount(Math.toIntExact(locationRepository.countTrackableConsumableRooms()))
                .stocks(consumableLocationStockRepository.findAllTrackableRoomStocksOrderByLocationAndAsset().stream()
                        .map(this::mapToConsumableLocationStockResponse)
                        .toList())
                .issueHistory(consumableIssueRepository.findAllTrackableRoomIssuesOrderByIssuedAtDesc().stream()
                        .map(this::mapToConsumableIssueResponse)
                        .toList())
                .requestHistory(consumableRequestRepository.findAllTrackableRoomRequestsOrderByCreatedAtDesc().stream()
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

    @Transactional(readOnly = true)
    public List<ExpiredConsumableLotResponse> getExpiredConsumableLots() {
        LocalDate today = LocalDate.now();
        return consumableReceiptLotRepository
                .findByQuantityRemainingGreaterThanAndExpirationDateBeforeOrderByExpirationDateAscReceivedDateAscIdAsc(0, today)
                .stream()
                .map((lot) -> mapToExpiredConsumableLotResponse(lot, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public ConsumableWarehouseOverviewResponse getConsumableWarehouseOverview(Integer warehouseLocationId) {
        Location selectedWarehouse = warehouseLocationId != null
                ? getConsumableWarehouseLocationOrThrow(warehouseLocationId, "Không tìm thấy kho với id: " + warehouseLocationId)
                : null;
        List<ConsumableWarehouseStockResponse> stocks = buildConsumableWarehouseStockResponses(selectedWarehouse);
        List<ConsumableWarehouseTransferResponse> transferHistory = getConsumableWarehouseTransfers(null).stream()
                .filter(item -> selectedWarehouse == null
                        || selectedWarehouse.getId().equals(item.getSourceWarehouseLocationId())
                        || selectedWarehouse.getId().equals(item.getTargetWarehouseLocationId()))
                .toList();
        BigDecimal totalInventoryValue = stocks.stream()
                .map(ConsumableWarehouseStockResponse::getInventoryValue)
                .filter(value -> value != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long lowStockCount = stocks.stream().filter(item -> Boolean.TRUE.equals(item.getLowStock())).count();
        long outOfStockCount = stocks.stream().filter(item -> Boolean.TRUE.equals(item.getOutOfStock())).count();
        return ConsumableWarehouseOverviewResponse.builder()
                .warehouseLocationId(selectedWarehouse != null ? selectedWarehouse.getId() : null)
                .warehouseLocationName(selectedWarehouse != null ? selectedWarehouse.getRoomName() : "Tất cả kho")
                .warehouseCount(selectedWarehouse != null ? 1 : getStorageWarehouses().size())
                .stockRowCount(stocks.size())
                .lowStockCount((int) lowStockCount)
                .outOfStockCount((int) outOfStockCount)
                .totalInventoryValue(totalInventoryValue)
                .stocks(stocks)
                .transferHistory(transferHistory)
                .build();
    }

    @Transactional(readOnly = true)
    public List<ConsumableWarehouseStockResponse> getConsumableWarehouseAlerts(Integer warehouseLocationId) {
        return buildConsumableWarehouseStockResponses(
                warehouseLocationId != null
                        ? getConsumableWarehouseLocationOrThrow(warehouseLocationId, "Không tìm thấy kho với id: " + warehouseLocationId)
                        : null
        ).stream()
                .filter(item -> Boolean.TRUE.equals(item.getLowStock()) || Boolean.TRUE.equals(item.getOutOfStock()))
                .sorted(Comparator
                        .comparing(ConsumableWarehouseStockResponse::getOutOfStock, Comparator.nullsLast(Boolean::compareTo)).reversed()
                        .thenComparing(ConsumableWarehouseStockResponse::getWarehouseLocationName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ConsumableWarehouseStockResponse::getAssetName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ConsumableWarehouseTransferResponse> getConsumableWarehouseTransfers(String qaCode) {
        List<ConsumableWarehouseTransfer> transfers = StringUtils.hasText(qaCode)
                ? consumableWarehouseTransferRepository.findByAssetQaCodeOrderByTransferredAtDescIdDesc(qaCode.trim())
                : consumableWarehouseTransferRepository.findAllByOrderByTransferredAtDescIdDesc();
        return transfers.stream()
                .map(this::mapToConsumableWarehouseTransferResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ConsumableDisposalRequestResponse> getConsumableDisposalRequests(String status) {
        List<ConsumableDisposalRequest> requests = StringUtils.hasText(status)
                ? consumableDisposalRequestRepository.findByStatusOrderByCreatedAtDescIdDesc(status.trim().toUpperCase())
                : consumableDisposalRequestRepository.findAllByOrderByCreatedAtDescIdDesc();
        return requests.stream()
                .map(this::mapToConsumableDisposalRequestResponse)
                .toList();
    }

    @Transactional
    public ConsumableDisposalRequestResponse createConsumableDisposalRequest(ConsumableDisposalRequestCreateRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu yêu cầu tiêu huỷ không được để trống.");
        }
        List<ValidatedDisposalItem> validatedItems = normalizeDisposalRequestItems(request.getItems(), LocalDate.now());
        if (validatedItems.isEmpty()) {
            throw new CustomException("Vui lòng chọn ít nhất một lô hàng để tiêu huỷ.");
        }
        AppUser requester = getCurrentUser();
        Asset asset = validatedItems.get(0).lot().getAsset();
        String reason = StringUtils.hasText(request.getReason()) ? request.getReason().trim() : "Do hết hạn sử dụng.";
        int totalQuantityRequested = validatedItems.stream()
                .mapToInt((item) -> item.quantityRequested())
                .sum();

        ConsumableDisposalRequest disposalRequest = ConsumableDisposalRequest.builder()
                .asset(asset)
                .receiptLot(validatedItems.get(0).lot())
                .requestedBy(requester)
                .quantityRequested(totalQuantityRequested)
                .reason(reason)
                .status("PENDING")
                .createdAt(UtcDateTimes.now())
                .build();
        List<ConsumableDisposalRequestItem> requestItems = new ArrayList<>();
        for (ValidatedDisposalItem item : validatedItems) {
            requestItems.add(ConsumableDisposalRequestItem.builder()
                    .disposalRequest(disposalRequest)
                    .receiptLot(item.lot())
                    .quantityRequested(item.quantityRequested())
                    .build());
        }
        disposalRequest.setItems(requestItems);
        ConsumableDisposalRequest savedRequest = consumableDisposalRequestRepository.save(disposalRequest);
        notificationService.createNotification(
                "CONSUMABLE_DISPOSAL_REQUEST_CREATED",
                "Có yêu cầu tiêu huỷ vật tư hết hạn",
                getActorDisplayName(requester) + " vừa tạo yêu cầu tiêu huỷ cho " + requestItems.size() + " lô của vật tư " + asset.getName() + ".",
                requester.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Vật tư", asset.getQaCode() + " - " + asset.getName(),
                        "Số lô cần tiêu huỷ", String.valueOf(requestItems.size()),
                        "Tổng số lượng tiêu huỷ", formatConsumableQuantity(asset, totalQuantityRequested),
                        "Người đề nghị", getActorDisplayName(requester),
                        "Lý do", reason
                ),
                consumableNotificationTargets(requester.getId(), "/mobile/home")
        );
        return mapToConsumableDisposalRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableDisposalRequestResponse createConsumableDisposalRequest(Long lotId, ConsumableDisposalRequestCreateRequest request) {
        if (lotId == null) {
            throw new CustomException("Không xác định được lô hàng cần tiêu huỷ.");
        }
        ConsumableReceiptLot lot = consumableReceiptLotRepository.findById(lotId)
                .orElseThrow(() -> new CustomException("Không tìm thấy lô vật tư cần tiêu huỷ."));
        ConsumableDisposalRequestCreateRequest normalizedRequest = ConsumableDisposalRequestCreateRequest.builder()
                .reason(request != null ? request.getReason() : null)
                .items(List.of(
                        ConsumableDisposalRequestItemCreateRequest.builder()
                                .receiptLotId(lotId)
                                .quantityRequested(safeInteger(lot.getQuantityRemaining()))
                                .build()
                ))
                .build();
        return createConsumableDisposalRequest(normalizedRequest);
    }

    @Transactional
    public ConsumableDisposalRequestResponse approveConsumableDisposalRequest(Long requestId, ConsumableRequestDecisionRequest request) {
        ConsumableDisposalRequest disposalRequest = consumableDisposalRequestRepository.findById(requestId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu tiêu huỷ."));
        if (!"PENDING".equalsIgnoreCase(disposalRequest.getStatus())) {
            throw new CustomException("Yêu cầu tiêu huỷ này đã được xử lý.");
        }
        Asset asset = assetRepository.findDetailByQaCode(disposalRequest.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy vật tư cần tiêu huỷ."));
        AppUser actor = getCurrentUser();
        LocalDateTime now = UtcDateTimes.now();
        String decisionNote = request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
        List<ConsumableDisposalRequestItem> requestItems = getEffectiveDisposalRequestItems(disposalRequest);
        int totalQuantityToDispose = requestItems.stream()
                .mapToInt((item) -> safePositiveInteger(item.getQuantityRequested(), "Số lượng tiêu huỷ phải lớn hơn 0."))
                .sum();
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        if (currentQuantity < totalQuantityToDispose) {
            throw new CustomException("Tồn kho hiện tại không đủ để ghi nhận tiêu huỷ các lô đã chọn.");
        }
        for (ConsumableDisposalRequestItem requestItem : requestItems) {
            ConsumableReceiptLot lot = consumableReceiptLotRepository.findById(requestItem.getReceiptLot().getId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy lô vật tư của yêu cầu tiêu huỷ."));
            validateExpiredLotForDisposal(lot, LocalDate.now());
            int quantityToDispose = safePositiveInteger(requestItem.getQuantityRequested(), "Số lượng tiêu huỷ phải lớn hơn 0.");
            int lotQuantityRemaining = safeInteger(lot.getQuantityRemaining());
            if (lotQuantityRemaining < quantityToDispose) {
                throw new CustomException("Số lượng còn lại của lô " + getLotDisplayName(lot) + " đã thay đổi, vui lòng tải lại dữ liệu.");
            }
            lot.setQuantityRemaining(lotQuantityRemaining - quantityToDispose);
            consumableReceiptLotRepository.save(lot);
        }
        recalculateConsumableQuantityOnHand(asset);
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updatedAsset = assetRepository.save(asset);

        disposalRequest.setStatus("APPROVED");
        disposalRequest.setDecisionNote(decisionNote);
        disposalRequest.setResolvedAt(now);
        disposalRequest.setResolvedBy(actor);
        ConsumableDisposalRequest savedRequest = consumableDisposalRequestRepository.save(disposalRequest);
        invalidateAssetCaches(updatedAsset.getQaCode());

        notificationService.createNotification(
                "CONSUMABLE_DISPOSAL_REQUEST_APPROVED",
                "Đã duyệt tiêu huỷ vật tư hết hạn",
                getActorDisplayName(actor) + " đã duyệt tiêu huỷ " + requestItems.size() + " lô của vật tư " + updatedAsset.getName() + ".",
                actor.getUsername(),
                updatedAsset.getQaCode(),
                updatedAsset.getName(),
                Map.of(
                        "Phiếu tiêu huỷ", "#" + savedRequest.getId(),
                        "Vật tư", updatedAsset.getQaCode() + " - " + updatedAsset.getName(),
                        "Số lô tiêu huỷ", String.valueOf(requestItems.size()),
                        "Tổng số lượng tiêu huỷ", formatConsumableQuantity(updatedAsset, totalQuantityToDispose),
                        "Người duyệt", getActorDisplayName(actor),
                        "Ghi chú xử lý", decisionNote == null ? "" : decisionNote
                ),
                consumableNotificationTargets(
                        disposalRequest.getRequestedBy() != null ? disposalRequest.getRequestedBy().getId() : null,
                        "/mobile/home"
                )
        );
        notifyLowStockIfNeeded(updatedAsset, actor);
        return mapToConsumableDisposalRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableDisposalRequestResponse rejectConsumableDisposalRequest(Long requestId, ConsumableRequestDecisionRequest request) {
        ConsumableDisposalRequest disposalRequest = consumableDisposalRequestRepository.findById(requestId)
                .orElseThrow(() -> new CustomException("Không tìm thấy yêu cầu tiêu huỷ."));
        if (!"PENDING".equalsIgnoreCase(disposalRequest.getStatus())) {
            throw new CustomException("Yêu cầu tiêu huỷ này đã được xử lý.");
        }
        if (request == null || !StringUtils.hasText(request.getNote())) {
            throw new CustomException("Vui lòng nhập lý do từ chối yêu cầu tiêu huỷ.");
        }
        AppUser actor = getCurrentUser();
        LocalDateTime now = UtcDateTimes.now();
        String decisionNote = request.getNote().trim();
        disposalRequest.setStatus("REJECTED");
        disposalRequest.setDecisionNote(decisionNote);
        disposalRequest.setResolvedAt(now);
        disposalRequest.setResolvedBy(actor);
        ConsumableDisposalRequest savedRequest = consumableDisposalRequestRepository.save(disposalRequest);

        notificationService.createNotification(
                "CONSUMABLE_DISPOSAL_REQUEST_REJECTED",
                "Yêu cầu tiêu huỷ vật tư bị từ chối",
                getActorDisplayName(actor) + " đã từ chối yêu cầu tiêu huỷ cho vật tư " + disposalRequest.getAsset().getName() + ".",
                actor.getUsername(),
                disposalRequest.getAsset().getQaCode(),
                disposalRequest.getAsset().getName(),
                Map.of(
                        "Phiếu tiêu huỷ", "#" + savedRequest.getId(),
                        "Vật tư", disposalRequest.getAsset().getQaCode() + " - " + disposalRequest.getAsset().getName(),
                        "Số lô trong phiếu", String.valueOf(getEffectiveDisposalRequestItems(disposalRequest).size()),
                        "Người duyệt", getActorDisplayName(actor),
                        "Lý do từ chối", decisionNote
                ),
                consumableNotificationTargets(
                        disposalRequest.getRequestedBy() != null ? disposalRequest.getRequestedBy().getId() : null,
                        "/mobile/home"
                )
        );
        return mapToConsumableDisposalRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableRequestResponse createConsumableRequest(Integer locationId, ConsumableRequestCreateRequest request) {
        return createConsumableRequestForRequester(locationId, request, getCurrentUser());
    }

    /**
     * Used by method security to keep ConsumableManager mutations scoped to
     * consumable inventory. Admin mutations do not need this lookup.
     */
    @Transactional(readOnly = true)
    public boolean isConsumableAsset(String qaCode) {
        if (!StringUtils.hasText(qaCode)) {
            return false;
        }
        return assetRepository.findById(qaCode)
                .map(asset -> isConsumableMode(asset.getTrackingMode()))
                .orElse(false);
    }

    @Transactional
    public ConsumableRequestResponse createConsumableRequestForRequester(
            Integer locationId,
            ConsumableRequestCreateRequest request,
            AppUser requester) {
        if (request == null) {
            throw new CustomException("Dữ liệu yêu cầu cấp phát không được để trống.");
        }
        if (requester == null || requester.getId() == null) {
            throw new CustomException("Không xác định được người yêu cầu cấp phát.");
        }
        if (!StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("Mã vật tư là bắt buộc.");
        }
        if (request.getSourceWarehouseLocationId() == null) {
            throw new CustomException("Kho xuất là bắt buộc.");
        }
        if (request.getQuantityRequested() == null || request.getQuantityRequested() <= 0) {
            throw new CustomException("Số lượng yêu cầu phải lớn hơn 0.");
        }
        if (!StringUtils.hasText(request.getReason())) {
            throw new CustomException("Lý do cấp phát là bắt buộc.");
        }
        Location location = getAssetStorageLocationOrThrow(locationId, "Không tìm thấy phòng với id: " + locationId);
        Asset asset = assetRepository.findDetailByQaCode(request.getAssetQaCode().trim())
                .orElseThrow(() -> new CustomException("Không tìm thấy vật tư với mã: " + request.getAssetQaCode()));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Chỉ vật tư tiêu hao mới hỗ trợ yêu cầu cấp phát.");
        }
        Location sourceWarehouseLocation = getConsumableWarehouseLocationOrThrow(
                request.getSourceWarehouseLocationId(),
                "Không tìm thấy kho xuất với id: " + request.getSourceWarehouseLocationId()
        );
        ConsumableRequest consumableRequest = ConsumableRequest.builder()
                .asset(asset)
                .location(location)
                .sourceWarehouseLocation(sourceWarehouseLocation)
                .requestedBy(requester)
                .quantityRequested(request.getQuantityRequested())
                .reason(request.getReason().trim())
                .status("PENDING")
                .createdAt(UtcDateTimes.now())
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
                        "Kho xuất", sourceWarehouseLocation.getRoomName(),
                        "Phòng yêu cầu", location.getRoomName(),
                        "Số lượng yêu cầu", formatConsumableQuantity(asset, request.getQuantityRequested()),
                        "Lý do", request.getReason().trim(),
                        "Người yêu cầu", getActorDisplayName(requester)
                ),
                consumableNotificationTargets(requester.getId(), "/mobile/home")
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
        AppUser actor = getCurrentUser();
        consumableInquiryFulfillmentRepository.findForUpdateByActiveConsumableRequestId(requestId)
                .ifPresent(fulfillment -> {
                    if (Boolean.TRUE.equals(fulfillment.getRequiresAdminApproval())
                            && !Boolean.TRUE.equals(fulfillment.getAdminApproved())) {
                        if (!"Admin".equals(actor.getRole())) {
                            throw new CustomException("Phiếu cấp phát này đang chờ Admin phê duyệt.");
                        }
                        fulfillment.setAdminApproved(true);
                        fulfillment.setAdminApprovedBy(actor);
                        fulfillment.setAdminApprovedAt(UtcDateTimes.now());
                        fulfillment.setUpdatedAt(UtcDateTimes.now());
                        consumableInquiryFulfillmentRepository.save(fulfillment);
                    }
                });
        Asset asset = assetRepository.findDetailByQaCode(consumableRequest.getAsset().getQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy vật tư yêu cầu cấp phát."));
        if (!isConsumableMode(asset.getTrackingMode())) {
            throw new CustomException("Phiếu này không áp dụng cho vật tư tiêu hao.");
        }
        int currentQuantity = safeInteger(asset.getQuantityOnHand());
        if (currentQuantity < safeInteger(consumableRequest.getQuantityRequested())) {
            throw new CustomException("Số lượng tồn không đủ để duyệt cấp phát phiếu này.");
        }

        LocalDateTime now = UtcDateTimes.now();
        Location sourceWarehouseLocation = resolveConsumableRequestSourceWarehouse(consumableRequest, request);
        List<LotAllocation> allocations = allocateConsumableLots(asset, sourceWarehouseLocation, consumableRequest.getQuantityRequested());
        BigDecimal unitPrice = calculateAllocatedUnitPrice(allocations, consumableRequest.getQuantityRequested());
        String decisionNote = request != null && StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
        String issueNote = appendLotAllocationNote(buildConsumableRequestIssueNote(consumableRequest, decisionNote), allocations);

        recalculateConsumableQuantityOnHand(asset);
        refreshConsumableExpirySummary(asset);
        asset.setStatus(computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock()));
        Asset updated = assetRepository.save(asset);
        consumableReceiptLotRepository.saveAll(allocations.stream().map(LotAllocation::lot).toList());

        ConsumableIssue issue = ConsumableIssue.builder()
                .asset(updated)
                .issuedToLocation(consumableRequest.getLocation())
                .sourceWarehouseLocation(sourceWarehouseLocation)
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
        consumableRequest.setSourceWarehouseLocation(sourceWarehouseLocation);
        consumableRequest.setDecisionNote(decisionNote);
        consumableRequest.setResolvedAt(now);
        consumableRequest.setResolvedBy(actor);
        ConsumableRequest savedRequest = consumableRequestRepository.save(consumableRequest);
        invalidateAssetCaches(updated.getQaCode());

        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CONSUMABLE_REQUEST_APPROVED",
                "Phiếu yêu cầu cấp phát đã được duyệt",
                actorDisplayName + " đã duyệt cấp phát " + formatConsumableQuantity(updated, consumableRequest.getQuantityRequested())
                        + " " + updated.getName() + " từ kho " + sourceWarehouseLocation.getRoomName()
                        + " cho phòng " + consumableRequest.getLocation().getRoomName() + ".",
                actor.getUsername(),
                updated.getQaCode(),
                updated.getName(),
                Map.of(
                        "Phiếu yêu cầu", "#" + consumableRequest.getId(),
                        "Vật tư", updated.getQaCode() + " - " + updated.getName(),
                        "Kho xuất", sourceWarehouseLocation.getRoomName(),
                        "Phòng nhận", consumableRequest.getLocation().getRoomName(),
                        "Số lượng cấp phát", formatConsumableQuantity(updated, consumableRequest.getQuantityRequested()),
                        "Người duyệt", actorDisplayName,
                        "Ghi chú xử lý", decisionNote == null ? "" : decisionNote
                ),
                consumableNotificationTargets(
                        consumableRequest.getRequestedBy() != null ? consumableRequest.getRequestedBy().getId() : null,
                        "/mobile/home"
                )
        );
        notifyLowStockIfNeeded(updated, actor);
        return mapToConsumableRequestResponse(savedRequest);
    }

    @Transactional
    public ConsumableRequestResponse fulfillConsumableRequest(
            Long requestId,
            Integer quantity,
            ConsumableRequestDecisionRequest request) {
        ConsumableRequest consumableRequest = consumableRequestRepository.findById(requestId)
                .orElseThrow(() -> new CustomException("Không tìm thấy phiếu yêu cầu cấp phát."));
        if (!"PENDING".equalsIgnoreCase(consumableRequest.getStatus())) {
            throw new CustomException("Phiếu yêu cầu này đã được xử lý.");
        }
        int pendingQuantity = safeInteger(consumableRequest.getQuantityRequested());
        if (quantity == null || quantity <= 0 || quantity > pendingQuantity) {
            throw new CustomException("Số lượng cấp phát phải lớn hơn 0 và không vượt quá số lượng còn chờ cấp.");
        }
        if (quantity != pendingQuantity) {
            consumableRequest.setQuantityRequested(quantity);
            consumableRequestRepository.save(consumableRequest);
        }
        return approveConsumableRequest(requestId, request);
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
        LocalDateTime now = UtcDateTimes.now();
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
                        "Kho xuất", consumableRequest.getSourceWarehouseLocation() != null
                                ? consumableRequest.getSourceWarehouseLocation().getRoomName()
                                : "",
                        "Phòng nhận", consumableRequest.getLocation().getRoomName(),
                        "Số lượng yêu cầu", consumableRequest.getQuantityRequested(),
                        "Người duyệt", actorDisplayName,
                        "Lý do từ chối", decisionNote
                ),
                consumableNotificationTargets(
                        consumableRequest.getRequestedBy() != null ? consumableRequest.getRequestedBy().getId() : null,
                        "/mobile/home"
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
        LocalDateTime now = UtcDateTimes.now();
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
                ),
                isConsumableMode(asset.getTrackingMode())
                        ? consumableNotificationTargets(null, null)
                        : adminNotificationTargets("/admin/assets")
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
        String technicalStatus = isConsumableMode(normalizedTrackingMode) ? null : getItemizedTechnicalStatus(asset);
        String usageStatus = isConsumableMode(normalizedTrackingMode) ? null : getItemizedUsageStatus(asset);
        String displayStatus = isConsumableMode(normalizedTrackingMode)
                ? computeConsumableStatus(asset.getQuantityOnHand(), asset.getMinimumStock())
                : getItemizedDisplayStatus(asset);
        return AssetResponse.builder()
                .qaCode(asset.getQaCode())
                .trackingMode(normalizedTrackingMode)
                .name(asset.getName())
                .categoryId(asset.getCategory().getId())
                .category(getCategoryDisplayName(asset.getCategory()))
                .status(displayStatus)
                .technicalStatus(technicalStatus)
                .usageStatus(usageStatus)
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
                .unit(getRetailUnit(asset))
                .retailUnit(isConsumableMode(normalizedTrackingMode) ? getRetailUnit(asset) : null)
                .wholesaleUnit(isConsumableMode(normalizedTrackingMode) ? getWholesaleUnit(asset) : null)
                .wholesaleToRetailFactor(isConsumableMode(normalizedTrackingMode) ? getWholesaleToRetailFactor(asset) : null)
                .formattedQuantityOnHand(isConsumableMode(normalizedTrackingMode) ? formatConsumableQuantity(asset, asset.getQuantityOnHand()) : null)
                .formattedMinimumStock(isConsumableMode(normalizedTrackingMode) ? formatConsumableQuantity(asset, asset.getMinimumStock()) : null)
                .supplierId(asset.getSupplier() != null ? asset.getSupplier().getId() : null)
                .supplierName(asset.getSupplier() != null ? asset.getSupplier().getName() : null)
                .supplierAddress(asset.getSupplier() != null ? asset.getSupplier().getAddress() : null)
                .supplierPhoneNumber(asset.getSupplier() != null ? asset.getSupplier().getPhoneNumber() : null)
                .receiptLots(isConsumableMode(normalizedTrackingMode) ? mapToConsumableReceiptLotResponses(asset.getQaCode()) : null)
                .qrCodeBase64(qrCodeBase64)
                .build();
    }

    public void evictAssetCaches(String qaCode) {
        invalidateAssetCaches(qaCode);
    }

    public void invalidateAssetCaches(String qaCode) {
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
        String technicalStatus = isConsumableMode(normalizedTrackingMode) ? null : getItemizedTechnicalStatus(item.getTechnicalStatus(), item.getStatus());
        String usageStatus = isConsumableMode(normalizedTrackingMode)
                ? null
                : getItemizedUsageStatus(
                        item.getUsageStatus(),
                        item.getStatus(),
                        item.getLocationId(),
                        item.getHomeLocationId()
                );
        String displayStatus = isConsumableMode(normalizedTrackingMode)
                ? computeConsumableStatus(item.getQuantityOnHand(), item.getMinimumStock())
                : AssetStatusSupport.deriveDisplayStatus(
                        technicalStatus,
                        usageStatus,
                        AssetStatusSupport.isRepairInProgress(item.getStatus())
                );
        return AssetResponse.builder()
                .qaCode(item.getQaCode())
                .trackingMode(normalizedTrackingMode)
                .name(item.getName())
                .categoryId(item.getCategoryId())
                .category(item.getCategoryName())
                .status(displayStatus)
                .technicalStatus(technicalStatus)
                .usageStatus(usageStatus)
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
                .retailUnit(isConsumableMode(normalizedTrackingMode) ? firstNonBlank(item.getRetailUnit(), item.getUnit()) : null)
                .wholesaleUnit(isConsumableMode(normalizedTrackingMode) ? firstNonBlank(item.getWholesaleUnit(), item.getRetailUnit(), item.getUnit()) : null)
                .wholesaleToRetailFactor(isConsumableMode(normalizedTrackingMode) ? safeWholesaleFactor(item.getWholesaleToRetailFactor()) : null)
                .formattedQuantityOnHand(isConsumableMode(normalizedTrackingMode)
                        ? formatConsumableQuantity(
                                item.getQuantityOnHand(),
                                firstNonBlank(item.getRetailUnit(), item.getUnit()),
                                firstNonBlank(item.getWholesaleUnit(), item.getRetailUnit(), item.getUnit()),
                                safeWholesaleFactor(item.getWholesaleToRetailFactor())
                        )
                        : null)
                .formattedMinimumStock(isConsumableMode(normalizedTrackingMode)
                        ? formatConsumableQuantity(
                                item.getMinimumStock(),
                                firstNonBlank(item.getRetailUnit(), item.getUnit()),
                                firstNonBlank(item.getWholesaleUnit(), item.getRetailUnit(), item.getUnit()),
                                safeWholesaleFactor(item.getWholesaleToRetailFactor())
                        )
                        : null)
                .supplierId(item.getSupplierId())
                .supplierName(item.getSupplierName())
                .createdAt(item.getCreatedAt())
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

    static Sort buildSort(String sortKey, String sortDirection) {
        String normalizedSortKey = StringUtils.hasText(sortKey) ? sortKey.trim() : "qaCode";
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return switch (normalizedSortKey) {
            case "createdAt" -> JpaSort
                    .unsafe(Sort.Direction.ASC, ASSET_CREATED_AT_MISSING_SORT_EXPRESSION)
                    .andUnsafe(direction, ASSET_CREATED_AT_SORT_EXPRESSION)
                    .and(Sort.by(Sort.Direction.DESC, "qaCode"));
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

    private Location getLocationOrThrow(Integer locationId, String notFoundMessage) {
        return locationRepository.findById(locationId)
                .orElseThrow(() -> new CustomException(notFoundMessage));
    }

    private Location getConsumableWarehouseLocationOrThrow(Integer locationId, String notFoundMessage) {
        Location location = getLocationOrThrow(locationId, notFoundMessage);
        if (!isStorageWarehouse(location)) {
            throw new CustomException("Phòng được chọn không phải kho lưu trữ.");
        }
        return location;
    }

    private Location getAssetStorageLocationOrThrow(Integer locationId, String notFoundMessage) {
        return getLocationOrThrow(locationId, notFoundMessage);
    }

    private boolean isStorageWarehouse(Location location) {
        if (location == null || !StringUtils.hasText(location.getAreaTypeKey())) {
            return false;
        }
        return areaTypeCatalogRepository.findByTypeKeyIgnoreCase(location.getAreaTypeKey())
                .map(areaType -> Boolean.TRUE.equals(areaType.getIsStorageWarehouse()))
                .orElse(false);
    }

    private Location resolveCurrentLocation(Integer currentLocationId, Location homeLocation) {
        if (currentLocationId == null) {
            return homeLocation;
        }
        return getAssetStorageLocationOrThrow(
                currentLocationId,
                "Không tìm thấy phòng hiện tại với id: " + currentLocationId
        );
    }

    private void validatePurchaseInfo(
            java.math.BigDecimal purchasePrice,
            LocalDate purchaseDate,
            LocalDate warrantyExpirationDate
    ) {
        if (purchasePrice != null && purchasePrice.signum() <= 0) {
            throw new CustomException("Giá mua phải lớn hơn 0.");
        }
        if (purchaseDate != null && purchaseDate.isAfter(LocalDate.now())) {
            throw new CustomException("Ngày mua không được ở tương lai.");
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
            if (!StringUtils.hasText(request.getRetailUnit())) {
                throw new CustomException("retailUnit là bắt buộc cho vật tư tiêu hao.");
            }
        }
        if (!StringUtils.hasText(request.getWholesaleUnit())) {
            throw new CustomException("wholesaleUnit là bắt buộc cho vật tư tiêu hao.");
        }
        if (request.getWholesaleToRetailFactor() == null || request.getWholesaleToRetailFactor() <= 0) {
            throw new CustomException("wholesaleToRetailFactor phải lớn hơn 0.");
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
        String retailUnit = normalizeRetailUnit(asset.getRetailUnit(), asset.getUnit());
        asset.setRetailUnit(retailUnit);
        asset.setUnit(retailUnit);
        asset.setWholesaleUnit(normalizeWholesaleUnit(asset.getWholesaleUnit()));
        asset.setWholesaleToRetailFactor(normalizeWholesaleToRetailFactor(asset.getWholesaleToRetailFactor()));
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

    private String normalizeAssetFilterStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        String normalized = status.trim();
        if ("Còn hàng".equals(normalized) || "Cần nhập".equals(normalized)) {
            return normalized;
        }
        return AssetStatusSupport.normalizeDisplayStatusFilter(normalized);
    }

    private String normalizeOptionalTechnicalStatusFilter(String technicalStatus) {
        if (!StringUtils.hasText(technicalStatus)) {
            return null;
        }
        return AssetStatusSupport.normalizeTechnicalStatus(technicalStatus);
    }

    private String normalizeOptionalUsageStatusFilter(String usageStatus) {
        if (!StringUtils.hasText(usageStatus)) {
            return null;
        }
        return AssetStatusSupport.normalizeUsageStatus(usageStatus);
    }

    private String normalizeRequestedTechnicalStatus(String technicalStatus, String legacyStatus) {
        try {
            if (StringUtils.hasText(technicalStatus)) {
                return AssetStatusSupport.normalizeTechnicalStatus(technicalStatus);
            }
            if (StringUtils.hasText(legacyStatus)) {
                return AssetStatusSupport.normalizeTechnicalStatus(legacyStatus);
            }
            return AssetStatusSupport.TECHNICAL_STATUS_GOOD;
        } catch (IllegalArgumentException ex) {
            throw new CustomException(ex.getMessage());
        }
    }

    private String normalizeRequestedUsageStatus(String usageStatus, String legacyStatus) {
        try {
            if (StringUtils.hasText(usageStatus)) {
                return AssetStatusSupport.normalizeUsageStatus(usageStatus);
            }
            if (StringUtils.hasText(legacyStatus)) {
                return AssetStatusSupport.normalizeUsageStatus(legacyStatus);
            }
            return AssetStatusSupport.USAGE_STATUS_HOME;
        } catch (IllegalArgumentException ex) {
            throw new CustomException(ex.getMessage());
        }
    }

    private String getItemizedTechnicalStatus(Asset asset) {
        return getItemizedTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
    }

    private String getItemizedTechnicalStatus(String technicalStatus, String legacyStatus) {
        return AssetStatusSupport.resolveTechnicalStatus(technicalStatus, legacyStatus);
    }

    private String getItemizedUsageStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.USAGE_STATUS_HOME;
        }
        Integer locationId = asset.getLocation() == null ? null : asset.getLocation().getId();
        Integer homeLocationId = asset.getHomeLocation() == null ? null : asset.getHomeLocation().getId();
        return getItemizedUsageStatus(asset.getUsageStatus(), asset.getStatus(), locationId, homeLocationId);
    }

    private String getItemizedUsageStatus(String usageStatus, String legacyStatus, Integer locationId, Integer homeLocationId) {
        return AssetStatusSupport.resolveUsageStatus(usageStatus, legacyStatus, locationId, homeLocationId);
    }

    private String getItemizedDisplayStatus(Asset asset) {
        return AssetStatusSupport.deriveDisplayStatus(
                getItemizedTechnicalStatus(asset),
                getItemizedUsageStatus(asset),
                AssetStatusSupport.isRepairInProgress(asset.getStatus())
        );
    }

    private void ensureItemizedStatusesInitialized(Asset asset) {
        if (asset == null || !isItemizedMode(asset.getTrackingMode())) {
            return;
        }
        asset.setTechnicalStatus(getItemizedTechnicalStatus(asset));
        asset.setUsageStatus(getItemizedUsageStatus(asset));
        syncItemizedLegacyStatus(asset, AssetStatusSupport.isRepairInProgress(asset.getStatus()));
    }

    private void syncItemizedLegacyStatus(Asset asset, boolean repairInProgress) {
        if (asset == null || !isItemizedMode(asset.getTrackingMode())) {
            return;
        }
        asset.setTechnicalStatus(normalizeCurrentTechnicalStatus(asset));
        asset.setUsageStatus(getItemizedUsageStatus(asset));
        asset.setStatus(AssetStatusSupport.deriveLegacyStatus(
                asset.getTechnicalStatus(),
                asset.getUsageStatus(),
                repairInProgress
        ));
    }

    private String normalizeCurrentTechnicalStatus(Asset asset) {
        if (asset == null || !StringUtils.hasText(asset.getTechnicalStatus())) {
            return getItemizedTechnicalStatus(asset);
        }
        try {
            return AssetStatusSupport.normalizeTechnicalStatus(asset.getTechnicalStatus());
        } catch (IllegalArgumentException ex) {
            throw new CustomException(ex.getMessage());
        }
    }

    private void applyLegacyStatusSelection(Asset asset, String rawStatus) {
        if (!StringUtils.hasText(rawStatus)) {
            return;
        }
        String normalized = AssetStatusSupport.normalizeDisplayStatusFilter(rawStatus);
        switch (normalized) {
            case AssetStatusSupport.DISPLAY_STATUS_GOOD -> {
                asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_GOOD);
                asset.setUsageStatus(AssetStatusSupport.USAGE_STATUS_HOME);
                syncItemizedLegacyStatus(asset, false);
            }
            case AssetStatusSupport.DISPLAY_STATUS_BORROWED -> {
                asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_GOOD);
                asset.setUsageStatus(AssetStatusSupport.USAGE_STATUS_BORROWED);
                syncItemizedLegacyStatus(asset, false);
            }
            case AssetStatusSupport.DISPLAY_STATUS_BROKEN -> {
                asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_BROKEN);
                syncItemizedLegacyStatus(asset, false);
            }
            case AssetStatusSupport.DISPLAY_STATUS_REPAIRING -> {
                asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_BROKEN);
                syncItemizedLegacyStatus(asset, true);
            }
            case AssetStatusSupport.DISPLAY_STATUS_LOST -> {
                asset.setTechnicalStatus(AssetStatusSupport.TECHNICAL_STATUS_LOST);
                syncItemizedLegacyStatus(asset, false);
            }
            default -> throw new CustomException("Trạng thái thiết bị không hợp lệ.");
        }
    }

    private void applyItemizedStatusUpdate(Asset asset, AssetUpdateRequest request) {
        if (asset == null || request == null || !isItemizedMode(asset.getTrackingMode())) {
            return;
        }
        if (StringUtils.hasText(request.getStatus())) {
            applyLegacyStatusSelection(asset, request.getStatus());
            return;
        }
        if (StringUtils.hasText(request.getTechnicalStatus())) {
            asset.setTechnicalStatus(normalizeRequestedTechnicalStatus(request.getTechnicalStatus(), null));
        }
        if (StringUtils.hasText(request.getUsageStatus())) {
            asset.setUsageStatus(normalizeRequestedUsageStatus(request.getUsageStatus(), null));
        }
        boolean hasTechnicalChange = StringUtils.hasText(request.getTechnicalStatus());
        boolean hasUsageChange = StringUtils.hasText(request.getUsageStatus());
        if (hasTechnicalChange || hasUsageChange) {
            syncItemizedLegacyStatus(asset, shouldPreserveRepairStatus(asset));
            return;
        }
    }

    static boolean shouldPreserveRepairStatus(Asset asset) {
        return asset != null && AssetStatusSupport.isRepairInProgress(asset.getStatus());
    }

    private void ensureTicketControlledStatusIsNotOverridden(Asset asset, AssetUpdateRequest request) {
        if (asset == null || request == null
                || !ticketRepository.existsByAssetQaCodeAndStatusIn(
                        asset.getQaCode(), TicketStatusSupport.ACTIVE_STATUSES)) {
            return;
        }
        if (StringUtils.hasText(request.getStatus())) {
            String currentDisplay = getItemizedDisplayStatus(asset);
            String requestedDisplay = AssetStatusSupport.normalizeDisplayStatusFilter(request.getStatus());
            if (!currentDisplay.equals(requestedDisplay)) {
                throw new CustomException(
                        "Không thể đổi trạng thái kỹ thuật khi tài sản đang có ticket hoạt động.");
            }
        }
        if (StringUtils.hasText(request.getTechnicalStatus())) {
            String currentTechnical = getItemizedTechnicalStatus(asset);
            String requestedTechnical = AssetStatusSupport.normalizeTechnicalStatus(request.getTechnicalStatus());
            if (!currentTechnical.equals(requestedTechnical)) {
                throw new CustomException(
                        "Không thể đổi tình trạng kỹ thuật khi tài sản đang có ticket hoạt động.");
            }
        }
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

    private String normalizeRetailUnit(String retailUnit, String legacyUnit) {
        return normalizeUnit(StringUtils.hasText(retailUnit) ? retailUnit : legacyUnit);
    }

    private String normalizeWholesaleUnit(String wholesaleUnit) {
        return normalizeUnit(wholesaleUnit);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private Integer normalizeWholesaleToRetailFactor(Integer factor) {
        if (factor == null || factor <= 0) {
            throw new CustomException("Hệ số quy đổi phải lớn hơn 0.");
        }
        return factor;
    }

    private String normalizeQuantityUnit(String quantityUnit) {
        if (!StringUtils.hasText(quantityUnit)) {
            return QUANTITY_UNIT_RETAIL;
        }
        String normalized = quantityUnit.trim().toUpperCase(Locale.ROOT);
        if (!QUANTITY_UNIT_RETAIL.equals(normalized) && !QUANTITY_UNIT_WHOLESALE.equals(normalized)) {
            throw new CustomException("Đơn vị số lượng không hợp lệ.");
        }
        return normalized;
    }

    private int convertToRetailQuantity(Asset asset, int quantity, String quantityUnit) {
        if (quantity <= 0) {
            throw new CustomException("Số lượng phải lớn hơn 0.");
        }
        return convertToRetailQuantityAllowZero(asset, quantity, quantityUnit);
    }

    private int convertToRetailQuantityAllowZero(Asset asset, int quantity, String quantityUnit) {
        if (quantity < 0) {
            throw new CustomException("Số lượng không được âm.");
        }
        if (!QUANTITY_UNIT_WHOLESALE.equals(quantityUnit)) {
            return quantity;
        }
        long converted = (long) quantity * getWholesaleToRetailFactor(asset);
        if (converted > Integer.MAX_VALUE) {
            throw new CustomException("Số lượng quy đổi vượt quá giới hạn cho phép.");
        }
        return (int) converted;
    }

    private BigDecimal normalizeRetailUnitPrice(Asset asset, BigDecimal unitPrice, String quantityUnit) {
        if (unitPrice == null || unitPrice.signum() <= 0) {
            throw new CustomException("Đơn giá nhập phải lớn hơn 0.");
        }
        if (!QUANTITY_UNIT_WHOLESALE.equals(quantityUnit)) {
            return unitPrice.setScale(2, RoundingMode.HALF_UP);
        }
        return unitPrice.divide(BigDecimal.valueOf(getWholesaleToRetailFactor(asset)), 2, RoundingMode.HALF_UP);
    }

    private String safeUnit(Asset asset) {
        return StringUtils.hasText(getRetailUnit(asset)) ? getRetailUnit(asset) : "đơn vị";
    }

    private String getRetailUnit(Asset asset) {
        if (asset == null) {
            return null;
        }
        return StringUtils.hasText(asset.getRetailUnit()) ? asset.getRetailUnit() : asset.getUnit();
    }

    private String getWholesaleUnit(Asset asset) {
        if (asset == null) {
            return null;
        }
        return StringUtils.hasText(asset.getWholesaleUnit()) ? asset.getWholesaleUnit() : getRetailUnit(asset);
    }

    private int getWholesaleToRetailFactor(Asset asset) {
        if (asset == null || asset.getWholesaleToRetailFactor() == null || asset.getWholesaleToRetailFactor() <= 0) {
            return 1;
        }
        return asset.getWholesaleToRetailFactor();
    }

    private int safeWholesaleFactor(Integer factor) {
        return factor == null || factor <= 0 ? 1 : factor;
    }

    private String formatConsumableQuantity(Asset asset, Integer quantity) {
        return formatConsumableQuantity(
                quantity,
                getRetailUnit(asset),
                getWholesaleUnit(asset),
                getWholesaleToRetailFactor(asset)
        );
    }

    private String formatConsumableQuantity(Integer quantity, String retailUnit, String wholesaleUnit, Integer factor) {
        int safeQuantity = safeInteger(quantity);
        String normalizedRetailUnit = StringUtils.hasText(retailUnit) ? retailUnit.trim() : "đơn vị";
        int safeFactor = factor == null || factor <= 0 ? 1 : factor;
        String normalizedWholesaleUnit = StringUtils.hasText(wholesaleUnit) ? wholesaleUnit.trim() : normalizedRetailUnit;
        if (safeFactor <= 1) {
            return safeQuantity + " " + normalizedRetailUnit;
        }
        int wholesaleQuantity = safeQuantity / safeFactor;
        int retailQuantity = safeQuantity % safeFactor;
        if (wholesaleQuantity > 0 && retailQuantity > 0) {
            return wholesaleQuantity + " " + normalizedWholesaleUnit + " + " + retailQuantity + " " + normalizedRetailUnit;
        }
        if (wholesaleQuantity > 0) {
            return wholesaleQuantity + " " + normalizedWholesaleUnit;
        }
        return retailQuantity + " " + normalizedRetailUnit;
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
            Location warehouseLocation,
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
                .warehouseLocation(warehouseLocation)
                .quantityReceived(quantity)
                .quantityRemaining(quantity)
                .unitPrice(unitPrice.setScale(2, RoundingMode.HALF_UP))
                .receivedDate(normalizedReceivedDate)
                .expirationDate(expirationDate)
                .lotCode(normalizeLotCode(lotCode))
                .note(StringUtils.hasText(note) ? note.trim() : null)
                .receivedBy(actor)
                .receivedAt(UtcDateTimes.now())
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

    private List<LotAllocation> allocateConsumableLots(Asset asset, Location sourceWarehouseLocation, int quantityRequested) {
        if (sourceWarehouseLocation == null || sourceWarehouseLocation.getId() == null) {
            throw new CustomException("Kho xuất không hợp lệ.");
        }
        List<ConsumableReceiptLot> availableLots = consumableReceiptLotRepository
                .findAvailableLotsForUpdate(
                        asset.getQaCode(),
                        sourceWarehouseLocation.getId()
                )
                .stream()
                .sorted(buildLotAllocationComparator(isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled())))
                .toList();
        if (availableLots.isEmpty()) {
            throw new CustomException("Không tìm thấy lô hàng còn tồn trong kho " + sourceWarehouseLocation.getRoomName() + " để cấp phát.");
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
            throw new CustomException("Số lượng tồn theo từng lô trong kho " + sourceWarehouseLocation.getRoomName() + " không đủ để cấp phát.");
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
        Location warehouseLocation = lot.getWarehouseLocation();
        Asset asset = lot.getAsset();
        return ConsumableReceiptLotResponse.builder()
                .id(lot.getId())
                .lotCode(lot.getLotCode())
                .quantityReceived(lot.getQuantityReceived())
                .quantityRemaining(lot.getQuantityRemaining())
                .formattedQuantityReceived(formatConsumableQuantity(asset, lot.getQuantityReceived()))
                .formattedQuantityRemaining(formatConsumableQuantity(asset, lot.getQuantityRemaining()))
                .unitPrice(lot.getUnitPrice())
                .receivedDate(lot.getReceivedDate())
                .expirationDate(lot.getExpirationDate())
                .supplierId(supplier != null ? supplier.getId() : null)
                .supplierName(supplier != null ? supplier.getName() : null)
                .warehouseLocationId(warehouseLocation != null ? warehouseLocation.getId() : null)
                .warehouseLocationName(warehouseLocation != null ? warehouseLocation.getRoomName() : null)
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
        int quantityConsumed = Math.max(0, quantityIssued - quantityRemaining);
        BigDecimal unitPrice = stock.getUnitPrice();
        BigDecimal remainingValue = unitPrice == null ? null : unitPrice.multiply(BigDecimal.valueOf(quantityRemaining));
        AppUser lastUpdatedBy = stock.getLastUpdatedBy();
        Asset asset = stock.getAsset();
        return ConsumableLocationStockResponse.builder()
                .id(stock.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .categoryId(asset.getCategory() != null ? asset.getCategory().getId() : null)
                .categoryName(getCategoryDisplayName(asset.getCategory()))
                .locationId(stock.getLocation().getId())
                .locationName(stock.getLocation().getRoomName())
                .quantityIssued(quantityIssued)
                .quantityRemaining(quantityRemaining)
                .quantityConsumed(quantityConsumed)
                .unit(getRetailUnit(asset))
                .formattedQuantityIssued(formatConsumableQuantity(asset, quantityIssued))
                .formattedQuantityRemaining(formatConsumableQuantity(asset, quantityRemaining))
                .formattedQuantityConsumed(formatConsumableQuantity(asset, quantityConsumed))
                .expiryTrackingEnabled(isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled()))
                .expirationDate(asset.getExpirationDate())
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

    private List<Location> getStorageWarehouses() {
        return locationRepository.searchByKeyword(null).stream()
                .filter(this::isStorageWarehouse)
                .toList();
    }

    private List<ConsumableWarehouseStockResponse> buildConsumableWarehouseStockResponses(Location selectedWarehouse) {
        List<ConsumableReceiptLot> activeLots = consumableReceiptLotRepository
                .findAllByOrderByWarehouseLocationRoomNameAscAssetNameAscReceivedDateAscIdAsc();

        Map<String, WarehouseStockAccumulator> groupedStocks = new LinkedHashMap<>();
        for (ConsumableReceiptLot lot : activeLots) {
            Location warehouseLocation = lot.getWarehouseLocation();
            if (warehouseLocation == null || warehouseLocation.getId() == null || !isStorageWarehouse(warehouseLocation)) {
                continue;
            }
            if (selectedWarehouse != null && !selectedWarehouse.getId().equals(warehouseLocation.getId())) {
                continue;
            }
            Asset asset = lot.getAsset();
            String key = warehouseLocation.getId() + "::" + asset.getQaCode();
            WarehouseStockAccumulator accumulator = groupedStocks.computeIfAbsent(
                    key,
                    ignored -> new WarehouseStockAccumulator(warehouseLocation, asset)
            );
            accumulator.addLot(lot);
        }

        return groupedStocks.values().stream()
                .map(WarehouseStockAccumulator::toResponse)
                .sorted(Comparator
                        .comparing(ConsumableWarehouseStockResponse::getWarehouseLocationName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ConsumableWarehouseStockResponse::getAssetName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    private ConsumableWarehouseTransferResponse mapToConsumableWarehouseTransferResponse(ConsumableWarehouseTransfer transfer) {
        AppUser transferredBy = transfer.getTransferredBy();
        Asset asset = transfer.getAsset();
        return ConsumableWarehouseTransferResponse.builder()
                .id(transfer.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .sourceWarehouseLocationId(transfer.getSourceWarehouseLocation().getId())
                .sourceWarehouseLocationName(transfer.getSourceWarehouseLocation().getRoomName())
                .targetWarehouseLocationId(transfer.getTargetWarehouseLocation().getId())
                .targetWarehouseLocationName(transfer.getTargetWarehouseLocation().getRoomName())
                .quantityTransferred(transfer.getQuantityTransferred())
                .unit(getRetailUnit(asset))
                .formattedQuantityTransferred(formatConsumableQuantity(asset, transfer.getQuantityTransferred()))
                .unitPrice(transfer.getUnitPrice())
                .transferredAt(transfer.getTransferredAt())
                .transferredByUserId(transferredBy != null ? transferredBy.getId() : null)
                .transferredByUsername(transferredBy != null ? transferredBy.getUsername() : null)
                .transferredByFullName(transferredBy != null ? transferredBy.getFullName() : null)
                .note(transfer.getNote())
                .build();
    }

    private String buildWarehouseTransferNote(
            String baseNote,
            Location sourceWarehouse,
            Location targetWarehouse,
            List<LotAllocation> allocations
    ) {
        String transferHeadline = "Chuyển kho nội bộ từ " + sourceWarehouse.getRoomName() + " sang " + targetWarehouse.getRoomName();
        return appendLotAllocationNote(
                StringUtils.hasText(baseNote)
                        ? transferHeadline + ". " + baseNote.trim()
                        : transferHeadline + ".",
                allocations
        );
    }

    private void recalculateConsumableQuantityOnHand(Asset asset) {
        if (!isConsumableMode(asset.getTrackingMode())) {
            return;
        }
        Integer totalQty = consumableReceiptLotRepository.calculateTotalQuantityRemainingForAsset(asset.getQaCode());
        asset.setQuantityOnHand(totalQty != null ? totalQty : 0);
    }

    private void notifyLowStockIfNeeded(Asset asset, AppUser actor) {
        if (!isConsumableMode(asset.getTrackingMode())) {
            return;
        }
        // Check per warehouse
        List<Location> warehouses = getStorageWarehouses();
        for (Location warehouse : warehouses) {
            Integer warehouseQty = consumableReceiptLotRepository.calculateQuantityRemainingForAssetInWarehouse(
                    asset.getQaCode(), 
                    warehouse.getId()
            );
            int qty = safeInteger(warehouseQty);
            int minStock = safeInteger(asset.getMinimumStock());
            if (qty <= minStock) {
                notificationService.createNotification(
                        "CONSUMABLE_LOW_STOCK",
                        "Vật tư cần nhập thêm",
                        asset.getName() + " hiện còn " + formatConsumableQuantity(asset, qty)
                                + " tại kho " + warehouse.getRoomName() + ".",
                        actor != null ? actor.getUsername() : "system",
                        asset.getQaCode(),
                        asset.getName(),
                        Map.of(
                                "Vật tư", asset.getQaCode() + " - " + asset.getName(),
                                "Tồn hiện tại", formatConsumableQuantity(asset, qty),
                                "Ngưỡng cảnh báo", formatConsumableQuantity(asset, minStock),
                                "Đơn vị tính", safeUnit(asset),
                                "Kho", warehouse.getRoomName()
                        ),
                        consumableNotificationTargets(null, null)
                );
            }
        }
    }

    private List<NotificationTarget> adminNotificationTargets(String adminPath) {
        return List.of(NotificationTarget.forRole("Admin", adminPath));
    }

    private List<NotificationTarget> consumableNotificationTargets(Integer requesterUserId, String requesterPath) {
        List<NotificationTarget> targets = new ArrayList<>();
        targets.add(NotificationTarget.forRole("Admin", "/admin/assets"));
        targets.add(NotificationTarget.forRole("ConsumableManager", "/supply/consumables"));
        if (requesterUserId != null) {
            targets.add(NotificationTarget.forUser(requesterUserId, requesterPath));
        }
        return targets;
    }

    private ConsumableIssueResponse mapToConsumableIssueResponse(ConsumableIssue issue) {
        Location sourceWarehouseLocation = issue.getSourceWarehouseLocation();
        Asset asset = issue.getAsset();
        return ConsumableIssueResponse.builder()
                .id(issue.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .issuedToLocationId(issue.getIssuedToLocation().getId())
                .issuedToLocationName(issue.getIssuedToLocation().getRoomName())
                .sourceWarehouseLocationId(sourceWarehouseLocation != null ? sourceWarehouseLocation.getId() : null)
                .sourceWarehouseLocationName(sourceWarehouseLocation != null ? sourceWarehouseLocation.getRoomName() : null)
                .quantity(issue.getQuantity())
                .unit(getRetailUnit(asset))
                .formattedQuantity(formatConsumableQuantity(asset, issue.getQuantity()))
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
        Location sourceWarehouseLocation = request.getSourceWarehouseLocation();
        Asset asset = request.getAsset();
        return ConsumableRequestResponse.builder()
                .id(request.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .locationId(request.getLocation().getId())
                .locationName(request.getLocation().getRoomName())
                .sourceWarehouseLocationId(sourceWarehouseLocation != null ? sourceWarehouseLocation.getId() : null)
                .sourceWarehouseLocationName(sourceWarehouseLocation != null ? sourceWarehouseLocation.getRoomName() : null)
                .quantityRequested(request.getQuantityRequested())
                .unit(getRetailUnit(asset))
                .formattedQuantityRequested(formatConsumableQuantity(asset, request.getQuantityRequested()))
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

    private ConsumableDisposalRequestResponse mapToConsumableDisposalRequestResponse(ConsumableDisposalRequest request) {
        AppUser requestedBy = request.getRequestedBy();
        AppUser resolvedBy = request.getResolvedBy();
        ConsumableReceiptLot receiptLot = request.getReceiptLot();
        Supplier supplier = receiptLot != null ? receiptLot.getSupplier() : null;
        List<ConsumableDisposalRequestItem> requestItems = getEffectiveDisposalRequestItems(request);
        Asset asset = request.getAsset();
        return ConsumableDisposalRequestResponse.builder()
                .id(request.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .unit(getRetailUnit(asset))
                .receiptLotId(receiptLot != null ? receiptLot.getId() : null)
                .lotCode(receiptLot != null ? receiptLot.getLotCode() : null)
                .quantityRequested(request.getQuantityRequested())
                .formattedQuantityRequested(formatConsumableQuantity(asset, request.getQuantityRequested()))
                .receivedDate(receiptLot != null ? receiptLot.getReceivedDate() : null)
                .expirationDate(receiptLot != null ? receiptLot.getExpirationDate() : null)
                .supplierName(supplier != null ? supplier.getName() : null)
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
                .itemCount(requestItems.size())
                .items(requestItems.stream().map(this::mapToConsumableDisposalRequestItemResponse).toList())
                .build();
    }

    private ConsumableDisposalRequestItemResponse mapToConsumableDisposalRequestItemResponse(ConsumableDisposalRequestItem item) {
        ConsumableReceiptLot receiptLot = item.getReceiptLot();
        Supplier supplier = receiptLot != null ? receiptLot.getSupplier() : null;
        Asset asset = receiptLot != null ? receiptLot.getAsset() : null;
        return ConsumableDisposalRequestItemResponse.builder()
                .id(item.getId())
                .receiptLotId(receiptLot != null ? receiptLot.getId() : null)
                .lotCode(getLotDisplayName(receiptLot))
                .quantityRequested(item.getQuantityRequested())
                .quantityRemainingAtRequest(receiptLot != null ? receiptLot.getQuantityRemaining() : null)
                .formattedQuantityRequested(formatConsumableQuantity(asset, item.getQuantityRequested()))
                .formattedQuantityRemainingAtRequest(formatConsumableQuantity(asset, receiptLot != null ? receiptLot.getQuantityRemaining() : null))
                .receivedDate(receiptLot != null ? receiptLot.getReceivedDate() : null)
                .expirationDate(receiptLot != null ? receiptLot.getExpirationDate() : null)
                .unitPrice(receiptLot != null ? receiptLot.getUnitPrice() : null)
                .supplierName(supplier != null ? supplier.getName() : null)
                .build();
    }

    private ExpiredConsumableLotResponse mapToExpiredConsumableLotResponse(ConsumableReceiptLot lot, LocalDate today) {
        Supplier supplier = lot.getSupplier();
        Asset asset = lot.getAsset();
        return ExpiredConsumableLotResponse.builder()
                .lotId(lot.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .unit(getRetailUnit(asset))
                .lotCode(lot.getLotCode())
                .quantityRemaining(safeInteger(lot.getQuantityRemaining()))
                .formattedQuantityRemaining(formatConsumableQuantity(asset, lot.getQuantityRemaining()))
                .unitPrice(lot.getUnitPrice())
                .receivedDate(lot.getReceivedDate())
                .expirationDate(lot.getExpirationDate())
                .supplierName(supplier != null ? supplier.getName() : null)
                .daysExpired(lot.getExpirationDate() == null ? 0 : ChronoUnit.DAYS.between(lot.getExpirationDate(), today))
                .pendingDisposal(consumableDisposalRequestItemRepository.existsByReceiptLotIdAndDisposalRequestStatus(lot.getId(), "PENDING"))
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

    private Location resolveConsumableRequestSourceWarehouse(
            ConsumableRequest consumableRequest,
            ConsumableRequestDecisionRequest request
    ) {
        Integer overrideWarehouseId = request != null ? request.getSourceWarehouseLocationId() : null;
        if (overrideWarehouseId != null) {
            return getConsumableWarehouseLocationOrThrow(
                    overrideWarehouseId,
                    "Không tìm thấy kho xuất với id: " + overrideWarehouseId
            );
        }

        Location existingSourceWarehouse = consumableRequest.getSourceWarehouseLocation();
        if (existingSourceWarehouse != null && existingSourceWarehouse.getId() != null) {
            return getConsumableWarehouseLocationOrThrow(
                    existingSourceWarehouse.getId(),
                    "Không tìm thấy kho xuất với id: " + existingSourceWarehouse.getId()
            );
        }

        Asset asset = consumableRequest.getAsset();
        Integer fallbackWarehouseId = asset != null && asset.getHomeLocation() != null ? asset.getHomeLocation().getId() : null;
        if (fallbackWarehouseId == null && asset != null && asset.getLocation() != null) {
            fallbackWarehouseId = asset.getLocation().getId();
        }
        if (fallbackWarehouseId == null) {
            throw new CustomException("Phiếu yêu cầu chưa có kho xuất nguồn.");
        }
        return getConsumableWarehouseLocationOrThrow(
                fallbackWarehouseId,
                "Không tìm thấy kho xuất với id: " + fallbackWarehouseId
        );
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
            case "Admin" -> "Quản trị hệ thống";
            case "NhanVien" -> "Nhân viên";
            case "TechSupport" -> "Kỹ thuật viên";
            case "ConsumableManager" -> "Nhân viên quản lý vật tư";
            default -> "Người dùng";
        };
    }

    private void validateExpiredLotForDisposal(ConsumableReceiptLot lot, LocalDate today) {
        if (lot == null || lot.getAsset() == null) {
            throw new CustomException("Không tìm thấy thông tin lô vật tư cần tiêu huỷ.");
        }
        if (!Boolean.TRUE.equals(lot.getAsset().getExpiryTrackingEnabled())) {
            throw new CustomException("Vật tư này không quản lý hạn sử dụng theo lô.");
        }
        if (safeInteger(lot.getQuantityRemaining()) <= 0) {
            throw new CustomException("Lô vật tư này không còn số lượng tồn để tiêu huỷ.");
        }
        if (lot.getExpirationDate() == null || !lot.getExpirationDate().isBefore(today)) {
            throw new CustomException("Chỉ có thể tạo yêu cầu tiêu huỷ cho lô đã hết hạn sử dụng.");
        }
    }

    private String getLotDisplayName(ConsumableReceiptLot lot) {
        if (lot == null) {
            return "Chưa cập nhật";
        }
        if (StringUtils.hasText(lot.getLotCode())) {
            return lot.getLotCode().trim();
        }
        return "Lô #" + lot.getId();
    }

    private void syncInitialConsumableLotExpiration(Asset asset, LocalDate expirationDate) {
        if (asset == null || !StringUtils.hasText(asset.getQaCode())) {
            return;
        }
        List<ConsumableReceiptLot> lots = consumableReceiptLotRepository.findByAssetQaCodeOrderByReceivedDateAscIdAsc(asset.getQaCode());
        if (lots.isEmpty()) {
            asset.setExpirationDate(expirationDate);
            return;
        }
        ConsumableReceiptLot initialLot = lots.get(0);
        initialLot.setExpirationDate(expirationDate);
        consumableReceiptLotRepository.save(initialLot);
    }

    private List<ValidatedDisposalItem> normalizeDisposalRequestItems(
            List<ConsumableDisposalRequestItemCreateRequest> items,
            LocalDate today
    ) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        List<ValidatedDisposalItem> normalizedItems = new ArrayList<>();
        Asset asset = null;
        for (ConsumableDisposalRequestItemCreateRequest item : items) {
            if (item == null || item.getReceiptLotId() == null) {
                throw new CustomException("Lô hàng tiêu huỷ không hợp lệ.");
            }
            ConsumableReceiptLot lot = consumableReceiptLotRepository.findById(item.getReceiptLotId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy lô vật tư cần tiêu huỷ."));
            if (asset == null) {
                asset = lot.getAsset();
            } else if (!asset.getQaCode().equals(lot.getAsset().getQaCode())) {
                throw new CustomException("Mỗi phiếu tiêu huỷ chỉ được gộp các lô của cùng một vật tư.");
            }
            validateExpiredLotForDisposal(lot, today);
            int quantityRequested = safePositiveInteger(item.getQuantityRequested(), "Số lượng tiêu huỷ phải lớn hơn 0.");
            if (safeInteger(lot.getQuantityRemaining()) < quantityRequested) {
                throw new CustomException("Số lượng tiêu huỷ của lô " + getLotDisplayName(lot) + " vượt quá số lượng còn lại.");
            }
            if (consumableDisposalRequestItemRepository.existsByReceiptLotIdAndDisposalRequestStatus(lot.getId(), "PENDING")) {
                throw new CustomException("Lô " + getLotDisplayName(lot) + " đã có yêu cầu tiêu huỷ đang chờ duyệt.");
            }
            normalizedItems.add(new ValidatedDisposalItem(lot, quantityRequested));
        }
        return normalizedItems;
    }

    private List<ConsumableDisposalRequestItem> getEffectiveDisposalRequestItems(ConsumableDisposalRequest request) {
        if (request != null && request.getItems() != null && !request.getItems().isEmpty()) {
            return request.getItems();
        }
        if (request == null || request.getReceiptLot() == null) {
            return List.of();
        }
        return List.of(
                ConsumableDisposalRequestItem.builder()
                        .disposalRequest(request)
                        .receiptLot(request.getReceiptLot())
                        .quantityRequested(request.getQuantityRequested())
                        .build()
        );
    }

    private class WarehouseStockAccumulator {
        private final Location warehouseLocation;
        private final Asset asset;
        private int quantityRemaining;
        private BigDecimal inventoryValue = BigDecimal.ZERO;
        private LocalDate nearestExpirationDate;
        private int activeLotCount;

        private WarehouseStockAccumulator(Location warehouseLocation, Asset asset) {
            this.warehouseLocation = warehouseLocation;
            this.asset = asset;
        }

        void addLot(ConsumableReceiptLot lot) {
            if (lot == null) {
                return;
            }
            int remaining = Math.max(0, lot.getQuantityRemaining() == null ? 0 : lot.getQuantityRemaining());
            if (remaining <= 0) {
                return;
            }
            quantityRemaining += remaining;
            activeLotCount += 1;
            if (lot.getUnitPrice() != null) {
                inventoryValue = inventoryValue.add(lot.getUnitPrice().multiply(BigDecimal.valueOf(remaining)));
            }
            if (lot.getExpirationDate() != null && (nearestExpirationDate == null || lot.getExpirationDate().isBefore(nearestExpirationDate))) {
                nearestExpirationDate = lot.getExpirationDate();
            }
        }

        ConsumableWarehouseStockResponse toResponse() {
            int minimumStock = asset != null ? (asset.getMinimumStock() == null ? 0 : asset.getMinimumStock()) : 0;
            boolean outOfStock = quantityRemaining <= 0;
            boolean lowStock = !outOfStock && quantityRemaining <= minimumStock;
            BigDecimal averageUnitPrice = quantityRemaining > 0
                    ? inventoryValue.divide(BigDecimal.valueOf(quantityRemaining), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            return ConsumableWarehouseStockResponse.builder()
                    .warehouseLocationId(warehouseLocation != null ? warehouseLocation.getId() : null)
                    .warehouseLocationName(warehouseLocation != null ? warehouseLocation.getRoomName() : null)
                    .assetQaCode(asset != null ? asset.getQaCode() : null)
                    .assetName(asset != null ? asset.getName() : null)
                    .categoryId(asset != null && asset.getCategory() != null ? asset.getCategory().getId() : null)
                    .categoryName(asset != null ? getCategoryDisplayName(asset.getCategory()) : null)
                    .quantityRemaining(quantityRemaining)
                    .minimumStock(minimumStock)
                    .unit(asset != null ? getRetailUnit(asset) : null)
                    .formattedQuantityRemaining(asset != null ? formatConsumableQuantity(asset, quantityRemaining) : null)
                    .formattedMinimumStock(asset != null ? formatConsumableQuantity(asset, minimumStock) : null)
                    .averageUnitPrice(averageUnitPrice)
                    .inventoryValue(inventoryValue)
                    .lowStock(lowStock)
                    .outOfStock(outOfStock)
                    .expiryTrackingEnabled(asset != null && isExpiryTrackingEnabled(asset.getExpiryTrackingEnabled()))
                    .nearestExpirationDate(nearestExpirationDate)
                    .activeLotCount(activeLotCount)
                    .build();
        }
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

    private record ValidatedDisposalItem(ConsumableReceiptLot lot, int quantityRequested) {
    }
}
