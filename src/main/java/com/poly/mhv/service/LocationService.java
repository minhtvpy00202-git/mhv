package com.poly.mhv.service;

import com.poly.mhv.dto.location.LocationCreateRequest;
import com.poly.mhv.dto.location.LocationResponse;
import com.poly.mhv.dto.location.LocationUpdateRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class LocationService {

    private static final long LOCATION_CACHE_TTL_MS = 60_000L;

    private final LocationRepository locationRepository;
    private final AssetRepository assetRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private volatile List<LocationResponse> cachedAllLocations;
    private volatile long cachedAllLocationsExpiresAt;

    public LocationService(
            LocationRepository locationRepository,
            AssetRepository assetRepository,
            UsageHistoryRepository usageHistoryRepository
    ) {
        this.locationRepository = locationRepository;
        this.assetRepository = assetRepository;
        this.usageHistoryRepository = usageHistoryRepository;
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
                .build();
        LocationResponse response = mapToResponse(locationRepository.save(location));
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
        LocationResponse response = mapToResponse(locationRepository.save(location));
        invalidateLocationCache();
        return response;
    }

    @Transactional
    public void deleteLocation(Integer id) {
        Location location = getLocationOrThrow(id);
        long linkedAssets = assetRepository.countByLocationIdOrHomeLocationId(id, id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa phòng đang được gán cho " + linkedAssets + " thiết bị.");
        }

        long linkedUsageHistories = usageHistoryRepository.countByFromLocationIdOrToLocationId(id, id);
        if (linkedUsageHistories > 0) {
            throw new CustomException("Không thể xóa phòng đã phát sinh lịch sử mượn trả.");
        }

        locationRepository.delete(location);
        invalidateLocationCache();
    }

    private void invalidateLocationCache() {
        cachedAllLocations = null;
        cachedAllLocationsExpiresAt = 0L;
    }

    private Location getLocationOrThrow(Integer id) {
        return locationRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy phòng với id: " + id));
    }

    private String normalizeRoomName(String roomName) {
        String normalizedRoomName = roomName == null ? null : roomName.trim();
        if (!StringUtils.hasText(normalizedRoomName)) {
            throw new CustomException("Tên phòng là bắt buộc.");
        }
        return normalizedRoomName;
    }

    private LocationResponse mapToResponse(Location location) {
        return LocationResponse.builder()
                .id(location.getId())
                .roomName(location.getRoomName())
                .build();
    }
}
