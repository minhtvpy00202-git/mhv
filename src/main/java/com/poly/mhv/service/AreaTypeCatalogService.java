package com.poly.mhv.service;

import com.poly.mhv.dto.assetmap.AreaTypeCatalogCreateRequest;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogResponse;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogUpdateRequest;
import com.poly.mhv.entity.AreaTypeCatalog;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.RoomShapeRepository;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AreaTypeCatalogService {

    private static final List<AreaTypeSeed> DEFAULT_AREA_TYPES = List.of(
            new AreaTypeSeed("ROOM", "Phòng", "Phòng hoặc khu chức năng có thể dùng để định vị tài sản.", true, 10),
            new AreaTypeSeed("TRAINING_AREA", "Sân tập", "Khu vực sinh hoạt, luyện tập hoặc sân chức năng có thể gắn tài sản.", true, 20),
            new AreaTypeSeed("WAREHOUSE", "Kho", "Khu vực kho hoặc nơi lưu trữ vật tư, thiết bị.", true, 30),
            new AreaTypeSeed("OFFICE", "Văn phòng", "Khu vực làm việc hoặc phòng ban có thể quản lý tài sản.", true, 40),
            new AreaTypeSeed("LAB", "Phòng thí nghiệm", "Phòng chức năng chuyên môn, thường có thiết bị đi kèm.", true, 50),
            new AreaTypeSeed("MEDICAL_ROOM", "Phòng y tế", "Phòng y tế hoặc chăm sóc sức khỏe có thể chứa tài sản chuyên dụng.", true, 60),
            new AreaTypeSeed("CORRIDOR", "Hành lang", "Khu vực lưu thông, thường không dùng để định vị tài sản.", false, 70),
            new AreaTypeSeed("STAIR", "Cầu thang", "Khu vực di chuyển theo tầng, thường không dùng để lưu trữ tài sản.", false, 80),
            new AreaTypeSeed("ELEVATOR", "Thang máy", "Khu vực thang máy hoặc giếng thang, không phải điểm gắn tài sản.", false, 90),
            new AreaTypeSeed("RESTROOM", "Nhà vệ sinh", "Khu vệ sinh hoặc tiện ích công cộng, thường không định vị tài sản.", false, 100),
            new AreaTypeSeed("GATE", "Cổng", "Khu vực cổng, lối ra vào hoặc kiểm soát truy cập.", false, 110),
            new AreaTypeSeed("ROAD", "Đường", "Đường nội bộ hoặc trục lưu thông ngoài trời.", false, 120),
            new AreaTypeSeed("PARKING", "Bãi đỗ xe", "Bãi xe hoặc khu vực đỗ phương tiện.", false, 130),
            new AreaTypeSeed("RESTRICTED", "Khu cấm", "Khu kỹ thuật hoặc khu vực hạn chế truy cập.", false, 140)
    );

    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final RoomShapeRepository roomShapeRepository;

    public AreaTypeCatalogService(AreaTypeCatalogRepository areaTypeCatalogRepository, RoomShapeRepository roomShapeRepository) {
        this.areaTypeCatalogRepository = areaTypeCatalogRepository;
        this.roomShapeRepository = roomShapeRepository;
    }

    @Transactional(readOnly = true)
    public List<AreaTypeCatalogResponse> getAllAreaTypes() {
        return areaTypeCatalogRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public AreaTypeCatalogResponse createAreaType(AreaTypeCatalogCreateRequest request) {
        ensureDefaultAreaTypes();
        String normalizedLabel = normalizeLabel(request.getLabel());
        String normalizedTypeKey = generateTypeKey(normalizedLabel);
        if (areaTypeCatalogRepository.existsByLabelIgnoreCase(normalizedLabel)) {
            throw new CustomException("Tên loại khu vực đã tồn tại.");
        }
        if (areaTypeCatalogRepository.existsByTypeKeyIgnoreCase(normalizedTypeKey)) {
            throw new CustomException("Mã loại khu vực đã tồn tại.");
        }

        AreaTypeCatalog saved = areaTypeCatalogRepository.save(AreaTypeCatalog.builder()
                .typeKey(normalizedTypeKey)
                .label(normalizedLabel)
                .description(normalizeDescription(request.getDescription()))
                .defaultHasAsset(resolveDefaultHasAsset(request.getDefaultHasAsset()))
                .builtIn(false)
                .sortOrder(nextSortOrder())
                .build());
        return mapToResponse(saved);
    }

    @Transactional
    public AreaTypeCatalogResponse updateAreaType(Integer id, AreaTypeCatalogUpdateRequest request) {
        ensureDefaultAreaTypes();
        AreaTypeCatalog areaType = getAreaTypeOrThrow(id);
        String normalizedLabel = normalizeLabel(request.getLabel());
        if (areaTypeCatalogRepository.existsByLabelIgnoreCaseAndIdNot(normalizedLabel, id)) {
            throw new CustomException("Tên loại khu vực đã tồn tại.");
        }

        areaType.setLabel(normalizedLabel);
        areaType.setDescription(normalizeDescription(request.getDescription()));
        areaType.setDefaultHasAsset(resolveDefaultHasAsset(request.getDefaultHasAsset()));
        return mapToResponse(areaTypeCatalogRepository.save(areaType));
    }

    @Transactional
    public void deleteAreaType(Integer id) {
        ensureDefaultAreaTypes();
        AreaTypeCatalog areaType = getAreaTypeOrThrow(id);
        if (Boolean.TRUE.equals(areaType.getBuiltIn())) {
            throw new CustomException("Không thể xóa loại khu vực mặc định của hệ thống.");
        }
        long usageCount = roomShapeRepository.countByAreaTypeKeyIgnoreCase(areaType.getTypeKey());
        if (usageCount > 0) {
            throw new CustomException("Không thể xóa loại khu vực đang được dùng ở " + usageCount + " khu vực trên sơ đồ.");
        }
        areaTypeCatalogRepository.delete(areaType);
    }

    @Transactional
    public void ensureDefaultAreaTypes() {
        for (AreaTypeSeed seed : DEFAULT_AREA_TYPES) {
            if (areaTypeCatalogRepository.findByTypeKeyIgnoreCase(seed.typeKey()).isPresent()) {
                continue;
            }
            areaTypeCatalogRepository.save(AreaTypeCatalog.builder()
                    .typeKey(seed.typeKey())
                    .label(seed.label())
                    .description(seed.description())
                    .defaultHasAsset(seed.defaultHasAsset())
                    .builtIn(true)
                    .sortOrder(seed.sortOrder())
                    .build());
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeDefaultAreaTypes() {
        ensureDefaultAreaTypes();
    }

    private AreaTypeCatalog getAreaTypeOrThrow(Integer id) {
        return areaTypeCatalogRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy loại khu vực với id: " + id));
    }

    private AreaTypeCatalogResponse mapToResponse(AreaTypeCatalog areaType) {
        return AreaTypeCatalogResponse.builder()
                .id(areaType.getId())
                .typeKey(areaType.getTypeKey())
                .label(areaType.getLabel())
                .description(areaType.getDescription())
                .defaultHasAsset(resolveDefaultHasAsset(areaType.getDefaultHasAsset()))
                .builtIn(Boolean.TRUE.equals(areaType.getBuiltIn()))
                .sortOrder(areaType.getSortOrder())
                .usageCount(roomShapeRepository.countByAreaTypeKeyIgnoreCase(areaType.getTypeKey()))
                .build();
    }

    private boolean resolveDefaultHasAsset(Boolean defaultHasAsset) {
        return defaultHasAsset != null && defaultHasAsset;
    }

    private String normalizeLabel(String label) {
        String normalized = label == null ? null : label.trim().replaceAll("\\s+", " ");
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Tên loại khu vực là bắt buộc.");
        }
        return normalized;
    }

    private String normalizeDescription(String description) {
        String normalized = description == null ? null : description.trim().replaceAll("\\s+", " ");
        return StringUtils.hasText(normalized) ? normalized : null;
    }

    private Integer nextSortOrder() {
        return areaTypeCatalogRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
                .map(AreaTypeCatalog::getSortOrder)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .map(value -> value + 10)
                .orElse(10);
    }

    private String generateTypeKey(String label) {
        String normalized = Normalizer.normalize(label, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "")
                .replaceAll("_+", "_");
        return StringUtils.hasText(normalized) ? normalized : "CUSTOM_AREA";
    }

    private record AreaTypeSeed(
            String typeKey,
            String label,
            String description,
            boolean defaultHasAsset,
            int sortOrder
    ) {
    }
}
