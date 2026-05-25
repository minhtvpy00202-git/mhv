package com.poly.mhv.service;

import com.poly.mhv.dto.techsupporttype.TechSupportTypeCreateRequest;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeResponse;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeUpdateRequest;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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
        String searchKey = normalizedKeyword == null ? null : normalizedKeyword.toLowerCase(Locale.ROOT);
        return techSupportTypeRepository.findAll().stream()
                .filter(type -> type.getId() != null && type.getId() > 0)
                .filter(type -> {
                    if (searchKey == null) {
                        return true;
                    }
                    String name = type.getName() == null ? "" : type.getName().toLowerCase(Locale.ROOT);
                    return name.contains(searchKey);
                })
                .sorted(Comparator.comparing(TechSupportType::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::mapToResponse)
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

    private TechSupportTypeResponse mapToResponse(TechSupportType techSupportType) {
        return TechSupportTypeResponse.builder()
                .id(techSupportType.getId())
                .name(techSupportType.getName())
                .categoryCount(categoryRepository.countByTechSupportTypeId(techSupportType.getId()))
                .techSupportUserCount(appUserRepository.countUsersByTechSupportTypeId(techSupportType.getId()))
                .build();
    }
}
