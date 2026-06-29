package com.poly.mhv.service;

import com.poly.mhv.dto.supplier.SupplierCreateRequest;
import com.poly.mhv.dto.supplier.SupplierResponse;
import com.poly.mhv.dto.supplier.SupplierUpdateRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.SupplierRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SupplierService {

    private static final long SUPPLIER_CACHE_TTL_MS = 60_000L;

    private final SupplierRepository supplierRepository;
    private final AssetRepository assetRepository;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private volatile List<SupplierResponse> cachedAllSuppliers;
    private volatile long cachedAllSuppliersExpiresAt;

    public SupplierService(
            SupplierRepository supplierRepository,
            AssetRepository assetRepository,
            NotificationService notificationService,
            CurrentUserProvider currentUserProvider
    ) {
        this.supplierRepository = supplierRepository;
        this.assetRepository = assetRepository;
        this.notificationService = notificationService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> getAll(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        long now = System.currentTimeMillis();
        if (normalizedKeyword == null) {
            List<SupplierResponse> cacheSnapshot = cachedAllSuppliers;
            if (cacheSnapshot != null && cachedAllSuppliersExpiresAt > now) {
                return cacheSnapshot;
            }
        }
        List<Supplier> suppliers = supplierRepository.searchForAdmin(normalizedKeyword);
        Map<Integer, Long> assetCountsBySupplierId = buildAssetCountMap(suppliers);
        List<SupplierResponse> items = suppliers.stream()
                .map(supplier -> mapToResponse(supplier, assetCountsBySupplierId))
                .toList();
        if (normalizedKeyword == null) {
            cachedAllSuppliers = items;
            cachedAllSuppliersExpiresAt = now + SUPPLIER_CACHE_TTL_MS;
        }
        return items;
    }

    @Transactional(readOnly = true)
    public SupplierResponse getById(Integer id) {
        return mapToResponse(getSupplierOrThrow(id));
    }

    @Transactional
    public SupplierResponse create(SupplierCreateRequest request) {
        String normalizedName = normalizeName(request.getName());
        if (supplierRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Tên nhà cung cấp đã tồn tại.");
        }
        Supplier supplier = Supplier.builder()
                .name(normalizedName)
                .address(normalizeAddress(request.getAddress()))
                .phoneNumber(normalizePhoneNumber(request.getPhoneNumber()))
                .build();
        Supplier saved = supplierRepository.save(supplier);
        SupplierResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "SUPPLIER_CREATE",
                "Tạo nhà cung cấp",
                actorDisplayName + " đã tạo nhà cung cấp " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        "Nhà cung cấp", saved.getName(),
                        "Địa chỉ", saved.getAddress(),
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateSupplierCache();
        return response;
    }

    @Transactional
    public SupplierResponse update(Integer id, SupplierUpdateRequest request) {
        Supplier supplier = getSupplierOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        if (supplierRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên nhà cung cấp đã tồn tại.");
        }
        supplier.setName(normalizedName);
        supplier.setAddress(normalizeAddress(request.getAddress()));
        supplier.setPhoneNumber(normalizePhoneNumber(request.getPhoneNumber()));
        Supplier saved = supplierRepository.save(supplier);
        SupplierResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "SUPPLIER_UPDATE",
                "Cập nhật nhà cung cấp",
                actorDisplayName + " đã cập nhật nhà cung cấp " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        "Nhà cung cấp", saved.getName(),
                        "Địa chỉ", saved.getAddress(),
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateSupplierCache();
        return response;
    }

    @Transactional
    public void delete(Integer id) {
        Supplier supplier = getSupplierOrThrow(id);
        long linkedAssets = assetRepository.countBySupplierId(id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa nhà cung cấp đang được gán cho " + linkedAssets + " thiết bị.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        supplierRepository.delete(supplier);
        notificationService.createNotification(
                "SUPPLIER_DELETE",
                "Xóa nhà cung cấp",
                actorDisplayName + " đã xóa nhà cung cấp " + supplier.getName() + ".",
                actor.getUsername(),
                null,
                supplier.getName(),
                Map.of(
                        "Nhà cung cấp", supplier.getName(),
                        "Địa chỉ", supplier.getAddress(),
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateSupplierCache();
    }

    private void invalidateSupplierCache() {
        cachedAllSuppliers = null;
        cachedAllSuppliersExpiresAt = 0L;
    }

    private Supplier getSupplierOrThrow(Integer id) {
        if (id == null || id <= 0) {
            throw new CustomException("Không tìm thấy nhà cung cấp.");
        }
        return supplierRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy nhà cung cấp với id: " + id));
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên nhà cung cấp là bắt buộc.");
        }
        return normalizedName;
    }

    private String normalizeAddress(String address) {
        String normalizedAddress = address == null ? null : address.trim();
        if (!StringUtils.hasText(normalizedAddress)) {
            throw new CustomException("Địa chỉ nhà cung cấp là bắt buộc.");
        }
        return normalizedAddress;
    }

    private String normalizePhoneNumber(String phoneNumber) {
        String normalizedPhoneNumber = phoneNumber == null ? null : phoneNumber.trim();
        if (!StringUtils.hasText(normalizedPhoneNumber)) {
            throw new CustomException("Số điện thoại nhà cung cấp là bắt buộc.");
        }
        return normalizedPhoneNumber;
    }

    private Map<Integer, Long> buildAssetCountMap(List<Supplier> suppliers) {
        List<Integer> supplierIds = suppliers.stream()
                .map(Supplier::getId)
                .toList();
        if (supplierIds.isEmpty()) {
            return Map.of();
        }
        return supplierRepository.countAssetsBySupplierIds(supplierIds).stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> (Long) row[1]
                ));
    }

    private SupplierResponse mapToResponse(Supplier supplier) {
        return mapToResponse(
                supplier,
                Map.of(supplier.getId(), assetRepository.countBySupplierId(supplier.getId()))
        );
    }

    private SupplierResponse mapToResponse(Supplier supplier, Map<Integer, Long> assetCountsBySupplierId) {
        return SupplierResponse.builder()
                .id(supplier.getId())
                .name(supplier.getName())
                .address(supplier.getAddress())
                .phoneNumber(supplier.getPhoneNumber())
                .assetCount(assetCountsBySupplierId.getOrDefault(supplier.getId(), 0L))
                .build();
    }

    private String getActorDisplayName(AppUser actor) {
        if (actor == null) {
            return "Hệ thống";
        }
        if (StringUtils.hasText(actor.getFullName())) {
            return actor.getFullName().trim();
        }
        return actor.getUsername();
    }
}
