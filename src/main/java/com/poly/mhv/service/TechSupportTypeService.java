package com.poly.mhv.service;

import com.poly.mhv.dto.techsupporttype.TechSupportTypeCreateRequest;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeResponse;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeUpdateRequest;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TechSupportTypeService {

    private final TechSupportTypeRepository techSupportTypeRepository;
    private final CategoryRepository categoryRepository;
    private final AppUserRepository appUserRepository;

    public TechSupportTypeService(
            TechSupportTypeRepository techSupportTypeRepository,
            CategoryRepository categoryRepository,
            AppUserRepository appUserRepository
    ) {
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.categoryRepository = categoryRepository;
        this.appUserRepository = appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<TechSupportTypeResponse> getAll(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        List<TechSupportType> techSupportTypes = techSupportTypeRepository.searchForAdmin(normalizedKeyword);
        Map<Integer, Long> categoryCountsByTechTypeId = buildCategoryCountMap(techSupportTypes);
        Map<Integer, Long> userCountsByTechTypeId = buildUserCountMap(techSupportTypes);
        return techSupportTypes.stream()
                .map(type -> mapToResponse(type, categoryCountsByTechTypeId, userCountsByTechTypeId))
                .toList();
    }

    @Transactional(readOnly = true)
    public TechSupportTypeResponse getById(Integer id) {
        return mapToResponse(getManageableTypeOrThrow(id));
    }

    @Transactional
    public TechSupportTypeResponse create(TechSupportTypeCreateRequest request) {
        String normalizedName = normalizeName(request.getName());
        if (techSupportTypeRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Tên loại kỹ thuật viên đã tồn tại.");
        }

        Integer nextId = techSupportTypeRepository.findMaxId() + 1;
        TechSupportType techSupportType = TechSupportType.builder()
                .id(nextId)
                .name(normalizedName)
                .build();
        return mapToResponse(techSupportTypeRepository.save(techSupportType));
    }

    @Transactional
    public TechSupportTypeResponse update(Integer id, TechSupportTypeUpdateRequest request) {
        TechSupportType techSupportType = getManageableTypeOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        if (techSupportTypeRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên loại kỹ thuật viên đã tồn tại.");
        }
        techSupportType.setName(normalizedName);
        return mapToResponse(techSupportTypeRepository.save(techSupportType));
    }

    @Transactional
    public void delete(Integer id) {
        TechSupportType techSupportType = getManageableTypeOrThrow(id);
        long linkedCategories = categoryRepository.countByTechSupportTypeId(id);
        if (linkedCategories > 0) {
            throw new CustomException("Không thể xóa loại kỹ thuật viên đang được gán cho " + linkedCategories + " loại thiết bị.");
        }
        long linkedUsers = appUserRepository.countUsersByTechSupportTypeId(id);
        if (linkedUsers > 0) {
            throw new CustomException("Không thể xóa loại kỹ thuật viên đang được gán cho " + linkedUsers + " tài khoản.");
        }
        techSupportTypeRepository.delete(techSupportType);
    }

    private TechSupportType getManageableTypeOrThrow(Integer id) {
        if (id == null || id <= 0) {
            throw new CustomException("Không tìm thấy loại kỹ thuật viên.");
        }
        return techSupportTypeRepository.findManageableById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy loại kỹ thuật viên với id: " + id));
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên loại kỹ thuật viên là bắt buộc.");
        }
        return normalizedName;
    }

    private Map<Integer, Long> buildCategoryCountMap(List<TechSupportType> techSupportTypes) {
        List<Integer> techTypeIds = techSupportTypes.stream()
                .map(TechSupportType::getId)
                .toList();
        if (techTypeIds.isEmpty()) {
            return Map.of();
        }
        return categoryRepository.countByTechSupportTypeIds(techTypeIds).stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> (Long) row[1]
                ));
    }

    private Map<Integer, Long> buildUserCountMap(List<TechSupportType> techSupportTypes) {
        List<Integer> techTypeIds = techSupportTypes.stream()
                .map(TechSupportType::getId)
                .toList();
        if (techTypeIds.isEmpty()) {
            return Map.of();
        }
        return appUserRepository.countUsersByTechSupportTypeIds(techTypeIds).stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> (Long) row[1]
                ));
    }

    private TechSupportTypeResponse mapToResponse(TechSupportType techSupportType) {
        return mapToResponse(
                techSupportType,
                Map.of(techSupportType.getId(), categoryRepository.countByTechSupportTypeId(techSupportType.getId())),
                Map.of(techSupportType.getId(), appUserRepository.countUsersByTechSupportTypeId(techSupportType.getId()))
        );
    }

    private TechSupportTypeResponse mapToResponse(
            TechSupportType techSupportType,
            Map<Integer, Long> categoryCountsByTechTypeId,
            Map<Integer, Long> userCountsByTechTypeId
    ) {
        return TechSupportTypeResponse.builder()
                .id(techSupportType.getId())
                .name(techSupportType.getName())
                .categoryCount(categoryCountsByTechTypeId.getOrDefault(techSupportType.getId(), 0L))
                .techSupportUserCount(userCountsByTechTypeId.getOrDefault(techSupportType.getId(), 0L))
                .build();
    }
}
