package com.poly.mhv.service;

import com.poly.mhv.dto.assetmap.AreaTypeCatalogCreateRequest;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogResponse;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogUpdateRequest;
import com.poly.mhv.entity.AreaTypeCatalog;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.RoomShapeRepository;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AreaTypeCatalogService {

    private static final List<AreaTypeSeed> DEFAULT_AREA_TYPES = List.of(
            new AreaTypeSeed("OFFICE_DEPARTMENT", "Văn phòng / Phòng ban", "Dùng cho phòng Marketing, phòng Giám đốc, phòng Kế toán hoặc phòng Giáo viên.", "WORKSPACE_TRAINING", "Không gian Làm việc & Đào tạo", 10),
            new AreaTypeSeed("MEETING_ROOM", "Phòng họp / Thảo luận", "Meeting room, phòng họp hội đồng hoặc không gian thảo luận nhóm.", "WORKSPACE_TRAINING", "Không gian Làm việc & Đào tạo", 20),
            new AreaTypeSeed("CLASSROOM_TRAINING", "Phòng học / Không gian đào tạo", "Dùng cho lớp học ở trường hoặc phòng training nội bộ, onboarding ở công ty.", "WORKSPACE_TRAINING", "Không gian Làm việc & Đào tạo", 30),
            new AreaTypeSeed("STORAGE_WAREHOUSE", "Kho lưu trữ", "Kho vật tư, kho văn phòng phẩm hoặc kho thiết bị.", "SPECIALIZED_OPERATION", "Không gian Chuyên dụng & Vận hành", 40),
            new AreaTypeSeed("TECH_SERVER_ROOM", "Phòng Kỹ thuật / Máy chủ", "Phòng Server, trạm điện hoặc khu kỹ thuật chuyên trách vận hành.", "SPECIALIZED_OPERATION", "Không gian Chuyên dụng & Vận hành", 50),
            new AreaTypeSeed("LAB_RD", "Phòng Thí nghiệm / R&D", "Phòng Lab trường học hoặc phòng nghiên cứu sản phẩm của công ty.", "SPECIALIZED_OPERATION", "Không gian Chuyên dụng & Vận hành", 60),
            new AreaTypeSeed("MEDICAL_ROOM", "Phòng Y tế", "Khu vực y tế, chăm sóc sức khỏe hoặc sơ cứu.", "SPECIALIZED_OPERATION", "Không gian Chuyên dụng & Vận hành", 70),
            new AreaTypeSeed("LOBBY_RECEPTION", "Sảnh / Khu vực lễ tân", "Lobby, tiền sảnh hoặc nơi đón tiếp khách.", "AMENITY_COMMUNICATION", "Không gian Tiện ích & Giao tiếp", 80),
            new AreaTypeSeed("PANTRY_DINING", "Khu vực ăn uống / Pantry", "Nhà ăn sinh viên, căn tin hoặc khu vực pha trà, cà phê cho nhân viên.", "AMENITY_COMMUNICATION", "Không gian Tiện ích & Giao tiếp", 90),
            new AreaTypeSeed("EVENT_HALL", "Khu vực sự kiện / Hội trường", "Nơi tổ chức sinh hoạt chung, hội thảo, sự kiện hoặc hội trường.", "AMENITY_COMMUNICATION", "Không gian Tiện ích & Giao tiếp", 100),
            new AreaTypeSeed("CORRIDOR_BALCONY", "Hành lang / Ban công", "Không gian chung và lưu thông, thường có camera, đèn, điều hòa hoặc thiết bị PCCC cố định.", "COMMON_CIRCULATION", "Không gian Chung & Lưu thông", 110),
            new AreaTypeSeed("STAIR_ELEVATOR", "Cầu thang / Thang máy", "Khu vực di chuyển theo tầng, vẫn có thể chứa nhiều tài sản cố định như camera hoặc thiết bị an toàn.", "COMMON_CIRCULATION", "Không gian Chung & Lưu thông", 120),
            new AreaTypeSeed("RESTROOM", "Nhà vệ sinh", "Không gian tiện ích chung, vẫn có thể phát sinh thiết bị cố định phục vụ vận hành.", "COMMON_CIRCULATION", "Không gian Chung & Lưu thông", 130),
            new AreaTypeSeed("PARKING", "Bãi đỗ xe", "Khu vực gửi xe, trông xe hoặc đỗ phương tiện.", "OUTDOOR", "Không gian Ngoài trời", 140),
            new AreaTypeSeed("OUTDOOR_CAMPUS", "Sân bãi / Khuôn viên", "Bao gồm sân tập, sân bóng, sân sinh hoạt chung hoặc khuôn viên ngoài trời.", "OUTDOOR", "Không gian Ngoài trời", 150),
            new AreaTypeSeed("GATE_GUARD", "Cổng / Trạm gác", "Cổng ra vào, chốt bảo vệ hoặc trạm gác kiểm soát truy cập.", "OUTDOOR", "Không gian Ngoài trời", 160)
    );

    private final AreaTypeCatalogRepository areaTypeCatalogRepository;
    private final RoomShapeRepository roomShapeRepository;
    private final LocationRepository locationRepository;

    public AreaTypeCatalogService(
            AreaTypeCatalogRepository areaTypeCatalogRepository,
            RoomShapeRepository roomShapeRepository,
            LocationRepository locationRepository
    ) {
        this.areaTypeCatalogRepository = areaTypeCatalogRepository;
        this.roomShapeRepository = roomShapeRepository;
        this.locationRepository = locationRepository;
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
        String normalizedAreaGroupLabel = normalizeAreaGroupLabel(request.getAreaGroupLabel());
        String normalizedAreaGroupKey = generateTypeKey(normalizedAreaGroupLabel);
        if (areaTypeCatalogRepository.existsByLabelIgnoreCase(normalizedLabel)) {
            throw new CustomException("Tên loại khu vực đã tồn tại.");
        }
        if (areaTypeCatalogRepository.existsByTypeKeyIgnoreCase(normalizedTypeKey)) {
            throw new CustomException("Mã loại khu vực đã tồn tại.");
        }

        AreaTypeCatalog saved = areaTypeCatalogRepository.save(AreaTypeCatalog.builder()
                .typeKey(normalizedTypeKey)
                .label(normalizedLabel)
                .areaGroupKey(normalizedAreaGroupKey)
                .areaGroupLabel(normalizedAreaGroupLabel)
                .description(normalizeDescription(request.getDescription()))
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
        String normalizedAreaGroupLabel = normalizeAreaGroupLabel(request.getAreaGroupLabel());
        String normalizedAreaGroupKey = generateTypeKey(normalizedAreaGroupLabel);
        if (areaTypeCatalogRepository.existsByLabelIgnoreCaseAndIdNot(normalizedLabel, id)) {
            throw new CustomException("Tên loại khu vực đã tồn tại.");
        }

        areaType.setLabel(normalizedLabel);
        areaType.setAreaGroupKey(normalizedAreaGroupKey);
        areaType.setAreaGroupLabel(normalizedAreaGroupLabel);
        areaType.setDescription(normalizeDescription(request.getDescription()));
        return mapToResponse(areaTypeCatalogRepository.save(areaType));
    }

    @Transactional
    public void deleteAreaType(Integer id) {
        ensureDefaultAreaTypes();
        AreaTypeCatalog areaType = getAreaTypeOrThrow(id);
        if (Boolean.TRUE.equals(areaType.getBuiltIn())) {
            throw new CustomException("Không thể xóa loại khu vực mặc định của hệ thống.");
        }
        long usageCount = countUsage(areaType.getTypeKey());
        if (usageCount > 0) {
            throw new CustomException("Không thể xóa loại khu vực đang được dùng ở " + usageCount + " khu vực.");
        }
        areaTypeCatalogRepository.delete(areaType);
    }

    @Transactional
    public void ensureDefaultAreaTypes() {
        Map<String, AreaTypeCatalog> existingByTypeKey = areaTypeCatalogRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
                .collect(Collectors.toMap(item -> item.getTypeKey().toUpperCase(Locale.ROOT), Function.identity(), (left, right) -> left));

        for (AreaTypeSeed seed : DEFAULT_AREA_TYPES) {
            AreaTypeCatalog areaType = existingByTypeKey.get(seed.typeKey());
            if (areaType == null) {
                areaType = areaTypeCatalogRepository.findByLabelIgnoreCase(seed.label()).orElseGet(AreaTypeCatalog::new);
            }
            areaType.setTypeKey(seed.typeKey());
            areaType.setLabel(seed.label());
            areaType.setAreaGroupKey(seed.areaGroupKey());
            areaType.setAreaGroupLabel(seed.areaGroupLabel());
            areaType.setDescription(seed.description());
            areaType.setBuiltIn(true);
            areaType.setSortOrder(seed.sortOrder());
            areaTypeCatalogRepository.save(areaType);
        }

        Set<String> activeBuiltInKeys = DEFAULT_AREA_TYPES.stream()
                .map(AreaTypeSeed::typeKey)
                .collect(Collectors.toSet());
        List<AreaTypeCatalog> obsoleteBuiltIns = areaTypeCatalogRepository.findAllByOrderBySortOrderAscLabelAsc().stream()
                .filter(item -> Boolean.TRUE.equals(item.getBuiltIn()))
                .filter(item -> !activeBuiltInKeys.contains(String.valueOf(item.getTypeKey()).toUpperCase(Locale.ROOT)))
                .toList();
        if (!obsoleteBuiltIns.isEmpty()) {
            areaTypeCatalogRepository.deleteAll(obsoleteBuiltIns);
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
                .areaGroupKey(areaType.getAreaGroupKey())
                .areaGroupLabel(areaType.getAreaGroupLabel())
                .description(areaType.getDescription())
                .builtIn(Boolean.TRUE.equals(areaType.getBuiltIn()))
                .sortOrder(areaType.getSortOrder())
                .usageCount(countUsage(areaType.getTypeKey()))
                .build();
    }

    private long countUsage(String areaTypeKey) {
        return roomShapeRepository.countByAreaTypeKeyIgnoreCase(areaTypeKey)
                + locationRepository.countByAreaTypeKeyIgnoreCase(areaTypeKey);
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

    private String normalizeAreaGroupLabel(String areaGroupLabel) {
        String normalized = areaGroupLabel == null ? null : areaGroupLabel.trim().replaceAll("\\s+", " ");
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Nhóm khu vực là bắt buộc.");
        }
        return normalized;
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
            String areaGroupKey,
            String areaGroupLabel,
            int sortOrder
    ) {
    }
}
