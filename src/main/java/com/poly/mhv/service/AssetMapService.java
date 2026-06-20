package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.assetmap.AssetMapAssetResponse;
import com.poly.mhv.dto.assetmap.AssetMapBoundsDto;
import com.poly.mhv.dto.assetmap.AssetMapBootstrapResponse;
import com.poly.mhv.dto.assetmap.AssetMapPointDto;
import com.poly.mhv.dto.assetmap.FloorLayoutSaveRequest;
import com.poly.mhv.dto.assetmap.MapFloorCreateRequest;
import com.poly.mhv.dto.assetmap.MapFloorResponse;
import com.poly.mhv.dto.assetmap.MapFloorUpdateRequest;
import com.poly.mhv.dto.assetmap.RoomShapeResponse;
import com.poly.mhv.dto.assetmap.RoomShapeSaveRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.MapFloor;
import com.poly.mhv.entity.MapFloorMode;
import com.poly.mhv.entity.RoomShape;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.MapFloorRepository;
import com.poly.mhv.repository.RoomShapeRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AssetMapService {

    private final MapFloorRepository mapFloorRepository;
    private final RoomShapeRepository roomShapeRepository;
    private final LocationRepository locationRepository;
    private final AssetRepository assetRepository;
    private final LocationService locationService;
    private final CategoryService categoryService;
    private final ObjectMapper objectMapper;

    public AssetMapService(
            MapFloorRepository mapFloorRepository,
            RoomShapeRepository roomShapeRepository,
            LocationRepository locationRepository,
            AssetRepository assetRepository,
            LocationService locationService,
            CategoryService categoryService,
            ObjectMapper objectMapper
    ) {
        this.mapFloorRepository = mapFloorRepository;
        this.roomShapeRepository = roomShapeRepository;
        this.locationRepository = locationRepository;
        this.assetRepository = assetRepository;
        this.locationService = locationService;
        this.categoryService = categoryService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public AssetMapBootstrapResponse getBootstrap() {
        return AssetMapBootstrapResponse.builder()
                .floors(getFloors())
                .locations(locationService.getAllLocations(null, null))
                .categories(categoryService.getCategoryOptions())
                .build();
    }

    @Transactional(readOnly = true)
    public List<MapFloorResponse> getFloors() {
        List<MapFloor> floors = mapFloorRepository.findAllByOrderBySortOrderAscIdAsc();
        List<RoomShape> shapes = roomShapeRepository.findAllWithFloorAndLocation();
        Map<Integer, List<RoomShapeResponse>> shapesByFloorId = new HashMap<>();
        for (RoomShape shape : shapes) {
            shapesByFloorId.computeIfAbsent(shape.getFloor().getId(), key -> new ArrayList<>())
                    .add(mapRoomShape(shape));
        }
        return floors.stream()
                .map(floor -> mapFloor(floor, shapesByFloorId.getOrDefault(floor.getId(), List.of())))
                .toList();
    }

    @Transactional
    public MapFloorResponse createFloor(MapFloorCreateRequest request) {
        String normalizedName = normalizeFloorName(request.getName());
        if (mapFloorRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Ten tang da ton tai.");
        }
        MapFloorMode floorMode = normalizeFloorMode(request.getMode(), MapFloorMode.GRID);
        MapFloor floor = MapFloor.builder()
                .name(normalizedName)
                .gridRows(normalizeGridSize(request.getGridRows(), 12, "So hang"))
                .gridCols(normalizeGridSize(request.getGridCols(), 20, "So cot"))
                .canvasBackgroundColor(normalizeColor(request.getCanvasBackgroundColor(), "#FFFFFF", "Mau nen canvas"))
                .mode(floorMode)
                .backgroundImageUrl(StringUtils.hasText(request.getBackgroundImageUrl()) ? request.getBackgroundImageUrl().trim() : null)
                .imageWidth(request.getImageWidth())
                .imageHeight(request.getImageHeight())
                .sortOrder(resolveSortOrder(request.getSortOrder()))
                .build();
        validateFloorMetadata(floor);
        return mapFloor(mapFloorRepository.save(floor), List.of());
    }

    @Transactional
    public MapFloorResponse updateFloor(Integer floorId, MapFloorUpdateRequest request) {
        MapFloor floor = getFloorOrThrow(floorId);
        String normalizedName = normalizeFloorName(request.getName());
        if (mapFloorRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, floorId)) {
            throw new CustomException("Ten tang da ton tai.");
        }
        Integer nextGridRows = normalizeGridSize(request.getGridRows(), floor.getGridRows(), "So hang");
        Integer nextGridCols = normalizeGridSize(request.getGridCols(), floor.getGridCols(), "So cot");
        if (!isImageFloor(floor)) {
            validateFloorBounds(floorId, nextGridRows, nextGridCols);
        }
        floor.setName(normalizedName);
        floor.setGridRows(nextGridRows);
        floor.setGridCols(nextGridCols);
        floor.setCanvasBackgroundColor(normalizeColor(
                request.getCanvasBackgroundColor(),
                floor.getCanvasBackgroundColor(),
                "Mau nen canvas"
        ));
        floor.setBackgroundImageUrl(StringUtils.hasText(request.getBackgroundImageUrl())
                ? request.getBackgroundImageUrl().trim()
                : floor.getBackgroundImageUrl());
        floor.setImageWidth(request.getImageWidth() != null ? request.getImageWidth() : floor.getImageWidth());
        floor.setImageHeight(request.getImageHeight() != null ? request.getImageHeight() : floor.getImageHeight());
        floor.setSortOrder(resolveSortOrder(request.getSortOrder(), floor.getSortOrder()));
        validateFloorMetadata(floor);
        MapFloor savedFloor = mapFloorRepository.save(floor);
        List<RoomShapeResponse> roomShapes = roomShapeRepository.findByFloorIdOrderByIdAsc(floorId).stream()
                .map(this::mapRoomShape)
                .toList();
        return mapFloor(savedFloor, roomShapes);
    }

    @Transactional
    public void deleteFloor(Integer floorId) {
        MapFloor floor = getFloorOrThrow(floorId);
        List<RoomShape> roomShapes = roomShapeRepository.findByFloorIdOrderByIdAsc(floorId);
        if (!roomShapes.isEmpty()) {
            roomShapeRepository.deleteAll(roomShapes);
        }
        List<Location> locations = locationRepository.findByFloorIdOrderByRoomNameAsc(floorId);
        for (Location location : locations) {
            location.setFloor(null);
        }
        if (!locations.isEmpty()) {
            locationRepository.saveAll(locations);
        }
        mapFloorRepository.delete(floor);
    }

    @Transactional
    public MapFloorResponse saveFloorLayout(Integer floorId, FloorLayoutSaveRequest request) {
        MapFloor floor = getFloorOrThrow(floorId);
        List<RoomShape> existingShapes = roomShapeRepository.findByFloorIdOrderByIdAsc(floorId);
        Map<Long, RoomShape> existingById = new HashMap<>();
        for (RoomShape shape : existingShapes) {
            existingById.put(shape.getId(), shape);
        }

        Set<String> usedCells = new HashSet<>();
        Set<Integer> usedLocationIds = new HashSet<>();
        Set<Long> retainedShapeIds = new HashSet<>();
        List<RoomShape> shapesToSave = new ArrayList<>();
        boolean imageFloor = isImageFloor(floor);
        List<RoomShapeSaveRequest> shapeRequests = request != null && request.getRoomShapes() != null
                ? request.getRoomShapes()
                : List.of();

        for (RoomShapeSaveRequest shapeRequest : shapeRequests) {
            List<String> cells = imageFloor
                    ? List.of()
                    : normalizeCells(shapeRequest.getCells(), floor.getGridRows(), floor.getGridCols());
            if (!imageFloor) {
                for (String cell : cells) {
                    if (!usedCells.add(cell)) {
                        throw new CustomException("Co o vuong bi trung giua nhieu phong.");
                    }
                }
            }
            List<AssetMapPointDto> points = imageFloor ? normalizeImagePoints(shapeRequest.getPoints()) : List.of();
            AssetMapBoundsDto bounds = imageFloor ? normalizeImageBounds(shapeRequest.getBounds(), points) : null;

            Location location = resolveLocation(shapeRequest, floor);
            if (!usedLocationIds.add(location.getId())) {
                throw new CustomException("Moi phong chi duoc gan mot vung tren mot lan luu.");
            }

            RoomShape roomShape = resolveRoomShape(shapeRequest, floorId, existingById, location);
            roomShape.setFloor(floor);
            roomShape.setLocation(location);
            roomShape.setCellsJson(writeCells(cells));
            roomShape.setPolygonJson(imageFloor ? writePoints(points) : null);
            roomShape.setBoundsJson(imageFloor ? writeBounds(bounds) : null);
            roomShape.setColorHex(normalizeColor(shapeRequest.getColorHex(), null, "Mau phong"));
            roomShape.setAreaTypeKey(shapeRequest.getAreaTypeKey());
            roomShape.setAreaTypeLabel(shapeRequest.getAreaTypeLabel());
            shapesToSave.add(roomShape);
            if (roomShape.getId() != null) {
                retainedShapeIds.add(roomShape.getId());
            }
        }

        List<RoomShape> shapesToDelete = existingShapes.stream()
                .filter(shape -> shape.getId() != null && !retainedShapeIds.contains(shape.getId()))
                .toList();
        if (!shapesToDelete.isEmpty()) {
            roomShapeRepository.deleteAll(shapesToDelete);
        }

        List<RoomShape> savedShapes = roomShapeRepository.saveAll(shapesToSave);
        List<RoomShapeResponse> roomShapes = savedShapes.stream()
                .map(this::mapRoomShape)
                .toList();
        return mapFloor(floor, roomShapes);
    }

    @Transactional(readOnly = true)
    public List<AssetMapAssetResponse> searchAssets(
            String keyword,
            Integer categoryId,
            Integer locationId,
            Integer floorId,
            String trackingMode
    ) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedTrackingMode = StringUtils.hasText(trackingMode)
                ? trackingMode.trim().toUpperCase()
                : null;
        return assetRepository.searchForAssetMap(normalizedKeyword, categoryId, locationId, floorId, normalizedTrackingMode);
    }

    private RoomShape resolveRoomShape(
            RoomShapeSaveRequest shapeRequest,
            Integer floorId,
            Map<Long, RoomShape> existingById,
            Location location
    ) {
        if (shapeRequest.getId() != null) {
            RoomShape existingShape = existingById.get(shapeRequest.getId());
            if (existingShape == null) {
                throw new CustomException("Khong tim thay vung phong de cap nhat.");
            }
            return existingShape;
        }

        Optional<RoomShape> shapeByLocation = roomShapeRepository.findByLocationId(location.getId());
        if (shapeByLocation.isPresent()) {
            RoomShape existingShape = shapeByLocation.get();
            if (!existingShape.getFloor().getId().equals(floorId)) {
                throw new CustomException("Phong da duoc gan tren so do cua tang khac.");
            }
            return existingShape;
        }
        return RoomShape.builder().build();
    }

    private Location resolveLocation(RoomShapeSaveRequest shapeRequest, MapFloor floor) {
        String normalizedRoomName = normalizeRoomName(shapeRequest.getRoomName(), shapeRequest.getLocationId());
        boolean requestedHasAsset = resolveRequestedHasAsset(shapeRequest.getHasAsset());
        if (shapeRequest.getLocationId() != null) {
            Location location = locationRepository.findById(shapeRequest.getLocationId())
                    .orElseThrow(() -> new CustomException("Khong tim thay phong de gan vao so do."));
            if (StringUtils.hasText(normalizedRoomName)
                    && !normalizedRoomName.equalsIgnoreCase(location.getRoomName())
                    && locationRepository.existsByRoomNameIgnoreCaseAndIdNot(normalizedRoomName, location.getId())) {
                throw new CustomException("Ten phong da ton tai.");
            }
            if (StringUtils.hasText(normalizedRoomName)) {
                location.setRoomName(normalizedRoomName);
            }
            validateHasAssetChange(location, requestedHasAsset);
            location.setHasAsset(requestedHasAsset);
            location.setFloor(floor);
            return locationRepository.save(location);
        }

        if (!StringUtils.hasText(normalizedRoomName)) {
            throw new CustomException("Can chon phong co san hoac nhap ten phong moi.");
        }
        if (locationRepository.existsByRoomNameIgnoreCase(normalizedRoomName)) {
            throw new CustomException("Ten phong da ton tai.");
        }
        return locationRepository.save(Location.builder()
                .roomName(normalizedRoomName)
                .floor(floor)
                .hasAsset(requestedHasAsset)
                .build());
    }

    private List<String> normalizeCells(List<String> rawCells, Integer maxRows, Integer maxCols) {
        if (rawCells == null || rawCells.isEmpty()) {
            throw new CustomException("Moi phong phai co it nhat mot o vuong.");
        }
        Set<String> normalizedCells = new LinkedHashSet<>();
        for (String rawCell : rawCells) {
            normalizedCells.add(normalizeCell(rawCell, maxRows, maxCols));
        }
        return List.copyOf(normalizedCells);
    }

    private String normalizeCell(String rawCell, Integer maxRows, Integer maxCols) {
        String value = rawCell == null ? "" : rawCell.trim();
        String[] parts = value.split(":");
        if (parts.length != 2) {
            throw new CustomException("O vuong khong hop le: " + rawCell);
        }
        try {
            int row = Integer.parseInt(parts[0]);
            int col = Integer.parseInt(parts[1]);
            if (row < 0 || col < 0 || row >= maxRows || col >= maxCols) {
                throw new CustomException("O vuong nam ngoai pham vi grid.");
            }
            return row + ":" + col;
        } catch (NumberFormatException ex) {
            throw new CustomException("O vuong khong hop le: " + rawCell);
        }
    }

    private String normalizeFloorName(String name) {
        String normalized = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Ten tang la bat buoc.");
        }
        return normalized;
    }

    private String normalizeRoomName(String roomName, Integer locationId) {
        String normalized = roomName == null ? null : roomName.trim();
        if (locationId == null && !StringUtils.hasText(normalized)) {
            throw new CustomException("Ten phong la bat buoc khi tao phong moi.");
        }
        return StringUtils.hasText(normalized) ? normalized : null;
    }

    private boolean resolveRequestedHasAsset(Boolean requestedHasAsset) {
        return requestedHasAsset == null || requestedHasAsset;
    }

    private boolean resolveHasAsset(Location location) {
        return location.getHasAsset() == null || location.getHasAsset();
    }

    private void validateHasAssetChange(Location location, boolean requestedHasAsset) {
        if (resolveHasAsset(location) == requestedHasAsset) {
            return;
        }
        if (assetRepository.countByLocationIdOrHomeLocationId(location.getId(), location.getId()) > 0) {
            throw new CustomException("Khong the doi trang thai chua tai san vi khu vuc nay da co tai san duoc gan.");
        }
    }

    private Integer normalizeGridSize(Integer value, Integer fallback, String label) {
        Integer resolved = value == null ? fallback : value;
        if (resolved == null || resolved < 4 || resolved > 100) {
            throw new CustomException(label + " phai trong khoang tu 4 den 100.");
        }
        return resolved;
    }

    private MapFloorMode normalizeFloorMode(String value, MapFloorMode fallback) {
        if (!StringUtils.hasText(value)) {
            return fallback;
        }
        try {
            return MapFloorMode.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new CustomException("Che do tang khong hop le.");
        }
    }

    private void validateFloorMetadata(MapFloor floor) {
        if (floor == null || !isImageFloor(floor)) {
            return;
        }
        if (!StringUtils.hasText(floor.getBackgroundImageUrl())) {
            throw new CustomException("Tang kieu anh phai co anh nen so do.");
        }
        if (floor.getImageWidth() == null || floor.getImageWidth() < 1 || floor.getImageHeight() == null || floor.getImageHeight() < 1) {
            throw new CustomException("Kich thuoc anh nen so do khong hop le.");
        }
    }

    private boolean isImageFloor(MapFloor floor) {
        return floor != null && floor.getMode() == MapFloorMode.IMAGE;
    }

    private Integer resolveSortOrder(Integer requestedSortOrder) {
        return resolveSortOrder(requestedSortOrder, nextSortOrder());
    }

    private Integer resolveSortOrder(Integer requestedSortOrder, Integer fallback) {
        return requestedSortOrder != null ? requestedSortOrder : (fallback != null ? fallback : 0);
    }

    private Integer nextSortOrder() {
        return mapFloorRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(MapFloor::getSortOrder)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .map(value -> value + 1)
                .orElse(1);
    }

    private MapFloor getFloorOrThrow(Integer floorId) {
        return mapFloorRepository.findById(floorId)
                .orElseThrow(() -> new CustomException("Khong tim thay tang voi id: " + floorId));
    }

    private RoomShapeResponse mapRoomShape(RoomShape shape) {
        return RoomShapeResponse.builder()
                .id(shape.getId())
                .floorId(shape.getFloor().getId())
                .floorName(shape.getFloor().getName())
                .locationId(shape.getLocation().getId())
                .roomName(shape.getLocation().getRoomName())
                .hasAsset(resolveHasAsset(shape.getLocation()))
                .cells(readCells(shape.getCellsJson()))
                .points(readPoints(shape.getPolygonJson()))
                .bounds(readBounds(shape.getBoundsJson()))
                .colorHex(shape.getColorHex())
                .areaTypeKey(shape.getAreaTypeKey())
                .areaTypeLabel(shape.getAreaTypeLabel())
                .build();
    }

    private MapFloorResponse mapFloor(MapFloor floor, List<RoomShapeResponse> roomShapes) {
        return MapFloorResponse.builder()
                .id(floor.getId())
                .name(floor.getName())
                .sortOrder(floor.getSortOrder())
                .mode((floor.getMode() != null ? floor.getMode() : MapFloorMode.GRID).name())
                .gridRows(floor.getGridRows())
                .gridCols(floor.getGridCols())
                .canvasBackgroundColor(normalizeColor(floor.getCanvasBackgroundColor(), "#FFFFFF", "Mau nen canvas"))
                .backgroundImageUrl(floor.getBackgroundImageUrl())
                .imageWidth(floor.getImageWidth())
                .imageHeight(floor.getImageHeight())
                .roomShapes(roomShapes)
                .build();
    }

    private List<String> readCells(String cellsJson) {
        if (!StringUtils.hasText(cellsJson)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(cellsJson, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the doc du lieu o vuong cua so do.");
        }
    }

    private String writeCells(List<String> cells) {
        try {
            return objectMapper.writeValueAsString(cells);
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the luu du lieu o vuong cua so do.");
        }
    }

    private List<AssetMapPointDto> normalizeImagePoints(List<AssetMapPointDto> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        List<AssetMapPointDto> normalized = new ArrayList<>();
        for (AssetMapPointDto point : points) {
            if (point == null || !Double.isFinite(point.getX()) || !Double.isFinite(point.getY())) {
                throw new CustomException("Toa do diem cua phong tren anh khong hop le.");
            }
            normalized.add(AssetMapPointDto.builder()
                    .x(point.getX())
                    .y(point.getY())
                    .build());
        }
        return List.copyOf(normalized);
    }

    private AssetMapBoundsDto normalizeImageBounds(AssetMapBoundsDto bounds, List<AssetMapPointDto> points) {
        if (bounds != null && isValidBounds(bounds)) {
            return AssetMapBoundsDto.builder()
                    .minX(bounds.getMinX())
                    .minY(bounds.getMinY())
                    .maxX(bounds.getMaxX())
                    .maxY(bounds.getMaxY())
                    .build();
        }
        if (points != null && !points.isEmpty()) {
            double minX = points.stream().mapToDouble(AssetMapPointDto::getX).min().orElse(0d);
            double minY = points.stream().mapToDouble(AssetMapPointDto::getY).min().orElse(0d);
            double maxX = points.stream().mapToDouble(AssetMapPointDto::getX).max().orElse(0d);
            double maxY = points.stream().mapToDouble(AssetMapPointDto::getY).max().orElse(0d);
            AssetMapBoundsDto derived = AssetMapBoundsDto.builder()
                    .minX(minX)
                    .minY(minY)
                    .maxX(maxX)
                    .maxY(maxY)
                    .build();
            if (isValidBounds(derived)) {
                return derived;
            }
        }
        throw new CustomException("Moi phong tren anh phai co vung hinh hoc hop le.");
    }

    private boolean isValidBounds(AssetMapBoundsDto bounds) {
        return bounds != null
                && Double.isFinite(bounds.getMinX())
                && Double.isFinite(bounds.getMinY())
                && Double.isFinite(bounds.getMaxX())
                && Double.isFinite(bounds.getMaxY())
                && bounds.getMaxX() > bounds.getMinX()
                && bounds.getMaxY() > bounds.getMinY();
    }

    private List<AssetMapPointDto> readPoints(String polygonJson) {
        if (!StringUtils.hasText(polygonJson)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(polygonJson, new TypeReference<List<AssetMapPointDto>>() {});
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the doc du lieu vung da ve tren anh.");
        }
    }

    private String writePoints(List<AssetMapPointDto> points) {
        try {
            return objectMapper.writeValueAsString(points != null ? points : List.of());
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the luu du lieu vung da ve tren anh.");
        }
    }

    private AssetMapBoundsDto readBounds(String boundsJson) {
        if (!StringUtils.hasText(boundsJson)) {
            return null;
        }
        try {
            return objectMapper.readValue(boundsJson, AssetMapBoundsDto.class);
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the doc khung vung phong tren anh.");
        }
    }

    private String writeBounds(AssetMapBoundsDto bounds) {
        try {
            return objectMapper.writeValueAsString(bounds);
        } catch (JsonProcessingException ex) {
            throw new CustomException("Khong the luu khung vung phong tren anh.");
        }
    }

    private void validateFloorBounds(Integer floorId, Integer gridRows, Integer gridCols) {
        List<RoomShape> shapes = roomShapeRepository.findByFloorIdOrderByIdAsc(floorId);
        int requiredRows = 0;
        int requiredCols = 0;
        for (RoomShape shape : shapes) {
            for (String cell : readCells(shape.getCellsJson())) {
                String[] parts = cell.split(":");
                if (parts.length != 2) {
                    continue;
                }
                try {
                    int row = Integer.parseInt(parts[0]);
                    int col = Integer.parseInt(parts[1]);
                    requiredRows = Math.max(requiredRows, row + 1);
                    requiredCols = Math.max(requiredCols, col + 1);
                } catch (NumberFormatException ignored) {
                    // skip invalid persisted cell entries; they are handled elsewhere when saving layout
                }
            }
        }
        if (gridRows < requiredRows || gridCols < requiredCols) {
            throw new CustomException(
                    "Kich thuoc canvas moi qua nho. Can it nhat "
                            + requiredRows
                            + " hang va "
                            + requiredCols
                            + " cot de chua cac phong hien co."
            );
        }
    }

    private String normalizeColor(String colorHex, String fallback, String label) {
        if (!StringUtils.hasText(colorHex)) {
            return StringUtils.hasText(fallback) ? fallback.toUpperCase() : null;
        }
        String normalized = colorHex.trim();
        if (!normalized.matches("^#[0-9A-Fa-f]{6}$")) {
            throw new CustomException(label + " khong hop le. Dung dinh dang #RRGGBB.");
        }
        return normalized.toUpperCase();
    }
}
