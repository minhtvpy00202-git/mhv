package com.poly.mhv.service;

import com.poly.mhv.dto.location.LocationCreateRequest;
import com.poly.mhv.dto.location.LocationResponse;
import com.poly.mhv.dto.location.LocationUpdateRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.MapFloor;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ConsumableIssueRepository;
import com.poly.mhv.repository.ConsumableReceiptLotRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.ConsumableWarehouseTransferRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.MapFloorRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class LocationService {

    private static final long LOCATION_CACHE_TTL_MS = 60_000L;

    private final LocationRepository locationRepository;
    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final AssetRepository assetRepository;
    private final ConsumableIssueRepository consumableIssueRepository;
    private final ConsumableReceiptLotRepository consumableReceiptLotRepository;
    private final ConsumableRequestRepository consumableRequestRepository;
    private final ConsumableWarehouseTransferRepository consumableWarehouseTransferRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private final MapFloorRepository mapFloorRepository;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private volatile List<LocationResponse> cachedAllLocations;
    private volatile long cachedAllLocationsExpiresAt;

    public LocationService(
            LocationRepository locationRepository,
            AreaTypeCatalogRepository areaTypeCatalogRepository,
            AssetRepository assetRepository,
            ConsumableIssueRepository consumableIssueRepository,
            ConsumableReceiptLotRepository consumableReceiptLotRepository,
            ConsumableRequestRepository consumableRequestRepository,
            ConsumableWarehouseTransferRepository consumableWarehouseTransferRepository,
            UsageHistoryRepository usageHistoryRepository,
            MapFloorRepository mapFloorRepository,
            NotificationService notificationService,
            CurrentUserProvider currentUserProvider
    ) {
        this.locationRepository = locationRepository;
        this.areaTypeCatalogRepository = areaTypeCatalogRepository;
        this.assetRepository = assetRepository;
        this.consumableIssueRepository = consumableIssueRepository;
        this.consumableReceiptLotRepository = consumableReceiptLotRepository;
        this.consumableRequestRepository = consumableRequestRepository;
        this.consumableWarehouseTransferRepository = consumableWarehouseTransferRepository;
        this.usageHistoryRepository = usageHistoryRepository;
        this.mapFloorRepository = mapFloorRepository;
        this.notificationService = notificationService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<LocationResponse> getAllLocations(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        long now = System.currentTimeMillis();
        if (normalizedKeyword == null) {
            List<LocationResponse> cacheSnapshot = cachedAllLocations;
            if (cacheSnapshot != null && cachedAllLocationsExpiresAt > now) {
                return cacheSnapshot;
            }
        }
        List<LocationResponse> items = locationRepository.searchByKeyword(normalizedKeyword).stream()
                .map(this::mapToResponse)
                .toList();
        if (normalizedKeyword == null) {
            cachedAllLocations = items;
            cachedAllLocationsExpiresAt = now + LOCATION_CACHE_TTL_MS;
        }
        return items;
    }

    @Transactional(readOnly = true)
    public LocationResponse getLocationById(Integer id) {
        return mapToResponse(getLocationOrThrow(id));
    }

    @Transactional
    public LocationResponse createLocation(LocationCreateRequest request) {
        String normalizedRoomName = normalizeRoomName(request.getRoomName());
        if (locationRepository.existsByRoomNameIgnoreCase(normalizedRoomName)) {
            throw new CustomException("Tên phòng đã tồn tại.");
        }

        Location location = Location.builder()
                .roomName(normalizedRoomName)
                .floor(resolveFloor(request.getFloorId()))
                .areaTypeKey(normalizeAreaTypeValue(request.getAreaTypeKey()))
                .areaTypeLabel(normalizeAreaTypeValue(request.getAreaTypeLabel()))
                .build();
        Location saved = locationRepository.save(location);
        LocationResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "LOCATION_CREATE",
                "Tạo phòng / khu vực",
                actorDisplayName + " đã tạo phòng / khu vực " + saved.getRoomName() + ".",
                actor.getUsername(),
                null,
                saved.getRoomName(),
                Map.of(
                        "Phòng / khu vực", saved.getRoomName(),
                        "Tầng", saved.getFloor() != null ? saved.getFloor().getName() : "Chưa gán tầng",
                        "Loại khu vực", StringUtils.hasText(saved.getAreaTypeLabel()) ? saved.getAreaTypeLabel() : "",
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateLocationCache();
        return response;
    }

    @Transactional
    public LocationResponse updateLocation(Integer id, LocationUpdateRequest request) {
        Location location = getLocationOrThrow(id);
        String normalizedRoomName = normalizeRoomName(request.getRoomName());
        if (locationRepository.existsByRoomNameIgnoreCaseAndIdNot(normalizedRoomName, id)) {
            throw new CustomException("Tên phòng đã tồn tại.");
        }

        location.setRoomName(normalizedRoomName);
        location.setFloor(resolveFloor(request.getFloorId()));
        location.setAreaTypeKey(normalizeAreaTypeValue(request.getAreaTypeKey()));
        location.setAreaTypeLabel(normalizeAreaTypeValue(request.getAreaTypeLabel()));
        Location saved = locationRepository.save(location);
        LocationResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "LOCATION_UPDATE",
                "Cập nhật phòng / khu vực",
                actorDisplayName + " đã cập nhật phòng / khu vực " + saved.getRoomName() + ".",
                actor.getUsername(),
                null,
                saved.getRoomName(),
                Map.of(
                        "Phòng / khu vực", saved.getRoomName(),
                        "Tầng", saved.getFloor() != null ? saved.getFloor().getName() : "Chưa gán tầng",
                        "Loại khu vực", StringUtils.hasText(saved.getAreaTypeLabel()) ? saved.getAreaTypeLabel() : "",
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateLocationCache();
        return response;
    }

    @Transactional
    public void deleteLocation(Integer id) {
        deleteLocationInternal(getLocationOrThrow(id));
        invalidateLocationCache();
    }

    @Transactional
    public int deleteLocations(List<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new CustomException("Can chon it nhat mot phong de xoa.");
        }

        Set<Integer> uniqueIds = new LinkedHashSet<>(ids.stream()
                .filter(id -> id != null)
                .toList());
        if (uniqueIds.isEmpty()) {
            throw new CustomException("Can chon it nhat mot phong hop le de xoa.");
        }

        List<Location> locations = uniqueIds.stream()
                .map(this::getLocationOrThrow)
                .toList();
        locations.forEach(this::validateLocationDeletion);
        locationRepository.deleteAll(locations);
        invalidateLocationCache();
        return locations.size();
    }

    public void invalidateLocationCache() {
        cachedAllLocations = null;
        cachedAllLocationsExpiresAt = 0L;
    }

    private Location getLocationOrThrow(Integer id) {
        return locationRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + id));
    }

    private void deleteLocationInternal(Location location) {
        validateLocationDeletion(location);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        locationRepository.delete(location);
        notificationService.createNotification(
                "LOCATION_DELETE",
                "Xóa phòng / khu vực",
                actorDisplayName + " đã xóa phòng / khu vực " + location.getRoomName() + ".",
                actor.getUsername(),
                null,
                location.getRoomName(),
                Map.of(
                        "Phòng / khu vực", location.getRoomName(),
                        "Tầng", location.getFloor() != null ? location.getFloor().getName() : "Chưa gán tầng",
                        "Loại khu vực", StringUtils.hasText(location.getAreaTypeLabel()) ? location.getAreaTypeLabel() : "",
                        "Người thực hiện", actorDisplayName
                )
        );
    }

    private void validateLocationDeletion(Location location) {
        Integer id = location.getId();
        long linkedAssets = assetRepository.countByLocationIdOrHomeLocationId(id, id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa phòng đang được gán cho " + linkedAssets + " thiết bị.");
        }

        long linkedUsageHistories = usageHistoryRepository.countByFromLocationIdOrToLocationId(id, id);
        if (linkedUsageHistories > 0) {
            throw new CustomException("Không thể xóa phòng đã phát sinh lịch sử mượn trả.");
        }

        long linkedReceiptLots = consumableReceiptLotRepository.countByWarehouseLocationId(id);
        if (linkedReceiptLots > 0) {
            throw new CustomException("Không thể xóa kho đang được ghi nhận trong " + linkedReceiptLots + " lô nhập vật tư.");
        }

        long linkedConsumableIssues = consumableIssueRepository.countBySourceWarehouseLocationId(id);
        if (linkedConsumableIssues > 0) {
            throw new CustomException("Không thể xóa kho đang được ghi nhận trong " + linkedConsumableIssues + " phiếu cấp phát vật tư.");
        }

        long linkedConsumableRequests = consumableRequestRepository.countBySourceWarehouseLocationId(id);
        if (linkedConsumableRequests > 0) {
            throw new CustomException("Không thể xóa kho đang được ghi nhận trong " + linkedConsumableRequests + " phiếu yêu cầu cấp phát.");
        }

        long linkedWarehouseTransfers = consumableWarehouseTransferRepository.countBySourceWarehouseLocationIdOrTargetWarehouseLocationId(id, id);
        if (linkedWarehouseTransfers > 0) {
            throw new CustomException("Không thể xóa kho đang được ghi nhận trong " + linkedWarehouseTransfers + " phiếu chuyển kho nội bộ.");
        }
    }

    private MapFloor resolveFloor(Integer floorId) {
        if (floorId == null) {
            return null;
        }
        return mapFloorRepository.findById(floorId)
                .orElseThrow(() -> new CustomException("Khong tim thay tang voi id: " + floorId));
    }

    private String normalizeRoomName(String roomName) {
        String normalizedRoomName = roomName == null ? null : roomName.trim();
        if (!StringUtils.hasText(normalizedRoomName)) {
            throw new CustomException("Tên phòng là bắt buộc.");
        }
        return normalizedRoomName;
    }

    private String normalizeAreaTypeValue(String value) {
        String normalizedValue = value == null ? null : value.trim();
        return StringUtils.hasText(normalizedValue) ? normalizedValue : null;
    }

    private LocationResponse mapToResponse(Location location) {
        return LocationResponse.builder()
                .id(location.getId())
                .roomName(location.getRoomName())
                .floorId(location.getFloor() != null ? location.getFloor().getId() : null)
                .floorName(location.getFloor() != null ? location.getFloor().getName() : null)
                .areaTypeKey(location.getAreaTypeKey())
                .areaTypeLabel(location.getAreaTypeLabel())
                .isStorageWarehouse(isStorageWarehouse(location.getAreaTypeKey()))
                .build();
    }

    private boolean isStorageWarehouse(String areaTypeKey) {
        if (!StringUtils.hasText(areaTypeKey)) {
            return false;
        }
        return areaTypeCatalogRepository.findByTypeKeyIgnoreCase(areaTypeKey)
                .map(areaType -> Boolean.TRUE.equals(areaType.getIsStorageWarehouse()))
                .orElse(false);
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
