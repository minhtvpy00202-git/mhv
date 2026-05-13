package com.poly.mhv.service;

import com.poly.mhv.dto.category.CategoryCreateRequest;
import com.poly.mhv.dto.category.CategoryResponse;
import com.poly.mhv.dto.category.CategoryUpdateRequest;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TechSupportTypeRepository techSupportTypeRepository;
    private final AssetRepository assetRepository;

    public CategoryService(
            CategoryRepository categoryRepository,
            TechSupportTypeRepository techSupportTypeRepository,
            AssetRepository assetRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.assetRepository = assetRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getAllCategories(String keyword, Integer techTypeId) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return categoryRepository.searchForAdmin(normalizedKeyword, techTypeId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Integer id) {
        return mapToResponse(getCategoryOrThrow(id));
    }

    @Transactional
    public CategoryResponse createCategory(CategoryCreateRequest request) {
        String normalizedName = normalizeName(request.getName());
        if (categoryRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Tên loại thiết bị đã tồn tại.");
        }

        Category category = Category.builder()
                .name(normalizedName)
                .techSupportType(getTechSupportTypeOrThrow(request.getTechTypeId()))
                .build();
        return mapToResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse updateCategory(Integer id, CategoryUpdateRequest request) {
        Category category = getCategoryOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên loại thiết bị đã tồn tại.");
        }

        category.setName(normalizedName);
        category.setTechSupportType(getTechSupportTypeOrThrow(request.getTechTypeId()));
        return mapToResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Integer id) {
        Category category = getCategoryOrThrow(id);
        long linkedAssets = assetRepository.countByCategoryId(id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa loại thiết bị đang được gán cho " + linkedAssets + " thiết bị.");
        }
        categoryRepository.delete(category);
    }

    private Category getCategoryOrThrow(Integer id) {
        return categoryRepository.findDetailById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy loại thiết bị với id: " + id));
    }

    private TechSupportType getTechSupportTypeOrThrow(Integer techTypeId) {
        return techSupportTypeRepository.findById(techTypeId)
                .orElseThrow(() -> new CustomException("Không tìm thấy nhóm kỹ thuật với id: " + techTypeId));
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên loại thiết bị là bắt buộc.");
        }
        return normalizedName;
    }

    private CategoryResponse mapToResponse(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .techTypeId(category.getTechSupportType().getId())
                .techTypeName(category.getTechSupportType().getName())
                .build();
    }
}
