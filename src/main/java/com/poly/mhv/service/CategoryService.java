package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.category.CategoryCreateRequest;
import com.poly.mhv.dto.category.CategoryOptionResponse;
import com.poly.mhv.dto.category.CategoryResponse;
import com.poly.mhv.dto.category.CategorySummaryResponse;
import com.poly.mhv.dto.category.CategoryUpdateRequest;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CategoryService {

    private static final long CATEGORY_OPTIONS_CACHE_TTL_MS = 60_000L;

    private final CategoryRepository categoryRepository;
    private final TechSupportTypeRepository techSupportTypeRepository;
    private final AssetRepository assetRepository;
    private final ObjectMapper objectMapper;
    private volatile List<CategoryOptionResponse> cachedCategoryOptions;
    private volatile long cachedCategoryOptionsExpiresAt;

    public CategoryService(
            CategoryRepository categoryRepository,
            TechSupportTypeRepository techSupportTypeRepository,
            AssetRepository assetRepository,
            ObjectMapper objectMapper
    ) {
        this.categoryRepository = categoryRepository;
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.assetRepository = assetRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<CategorySummaryResponse> getAllCategories(String keyword, Integer techTypeId) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return categoryRepository.searchForAdmin(normalizedKeyword, techTypeId);
    }

    @Transactional(readOnly = true)
    public List<CategoryOptionResponse> getCategoryOptions() {
        long now = System.currentTimeMillis();
        List<CategoryOptionResponse> cacheSnapshot = cachedCategoryOptions;
        if (cacheSnapshot != null && cachedCategoryOptionsExpiresAt > now) {
            return cacheSnapshot;
        }
        List<CategoryOptionResponse> items = categoryRepository.findAllOptions();
        cachedCategoryOptions = items;
        cachedCategoryOptionsExpiresAt = now + CATEGORY_OPTIONS_CACHE_TTL_MS;
        return items;
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
        String generatedCodePrefix = generateCodePrefix(normalizedName);

        Category category = Category.builder()
                .name(normalizedName)
                .codePrefix(generatedCodePrefix)
                .techSupportType(getTechSupportTypeOrThrow(request.getTechTypeId()))
                .specTemplates(normalizeSpecTemplates(request.getSpecTemplates()))
                .build();
        CategoryResponse response = mapToResponse(categoryRepository.save(category));
        invalidateCategoryOptionsCache();
        return response;
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
        category.setSpecTemplates(normalizeSpecTemplates(request.getSpecTemplates()));
        CategoryResponse response = mapToResponse(categoryRepository.save(category));
        invalidateCategoryOptionsCache();
        return response;
    }

    @Transactional
    public void deleteCategory(Integer id) {
        Category category = getCategoryOrThrow(id);
        long linkedAssets = assetRepository.countByCategoryId(id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa loại thiết bị đang được gán cho " + linkedAssets + " thiết bị.");
        }
        categoryRepository.delete(category);
        invalidateCategoryOptionsCache();
    }

    private void invalidateCategoryOptionsCache() {
        cachedCategoryOptions = null;
        cachedCategoryOptionsExpiresAt = 0L;
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

    private String generateCodePrefix(String categoryName) {
        List<String> meaningfulWords = extractMeaningfulWords(categoryName);
        if (meaningfulWords.isEmpty()) {
            throw new CustomException("Không thể sinh code prefix cho loại thiết bị này.");
        }

        Set<String> candidates = new LinkedHashSet<>();
        int prefixLength = Math.min(3, meaningfulWords.size());
        collectPrefixCandidates(meaningfulWords, 0, prefixLength, new StringBuilder(), candidates);

        for (String candidate : candidates) {
            if (!categoryRepository.existsByCodePrefixIgnoreCase(candidate)) {
                return candidate;
            }
        }

        throw new CustomException("Không thể sinh code prefix duy nhất cho loại thiết bị này.");
    }

    private List<String> extractMeaningfulWords(String categoryName) {
        String normalizedCategoryName = normalizeKeyword(categoryName);
        if (normalizedCategoryName == null) {
            throw new CustomException("Tên loại thiết bị không hợp lệ.");
        }
        List<String> words = new ArrayList<>(List.of(
                normalizedCategoryName
                        .replace('/', ' ')
                        .replaceAll("\\s+", " ")
                        .trim()
                        .split(" ")
        ));
        if (words.size() >= 2 && "thiet".equals(words.get(0)) && "bi".equals(words.get(1))) {
            words = new ArrayList<>(words.subList(2, words.size()));
        }
        words.removeIf(word -> !StringUtils.hasText(word));
        return words;
    }

    private void collectPrefixCandidates(
            List<String> words,
            int startIndex,
            int targetLength,
            StringBuilder current,
            Set<String> candidates
    ) {
        if (current.length() == targetLength) {
            candidates.add(current.toString());
            return;
        }

        for (int index = startIndex; index < words.size(); index++) {
            String word = words.get(index);
            if (!StringUtils.hasText(word)) {
                continue;
            }
            current.append(Character.toUpperCase(word.charAt(0)));
            collectPrefixCandidates(words, index + 1, targetLength, current, candidates);
            current.deleteCharAt(current.length() - 1);
        }
    }

    private String normalizeKeyword(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT);
    }

    private CategoryResponse mapToResponse(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .codePrefix(category.getCodePrefix())
                .techTypeId(category.getTechSupportType().getId())
                .techTypeName(category.getTechSupportType().getName())
                .specTemplates(parseSpecTemplates(category.getSpecTemplates()))
                .build();
    }

    private String normalizeSpecTemplates(List<String> specTemplates) {
        List<String> normalizedTemplates = specTemplates == null
                ? List.of()
                : specTemplates.stream()
                .map(template -> template == null ? "" : template.trim())
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        try {
            return objectMapper.writeValueAsString(normalizedTemplates);
        } catch (JsonProcessingException ex) {
            throw new CustomException("Không thể lưu template đặc tính kỹ thuật.");
        }
    }

    private List<String> parseSpecTemplates(String specTemplatesJson) {
        if (!StringUtils.hasText(specTemplatesJson)) {
            return List.of();
        }
        try {
            List<String> templates = objectMapper.readValue(specTemplatesJson, new TypeReference<List<String>>() {
            });
            return templates.stream()
                    .map(template -> template == null ? "" : template.trim())
                    .filter(StringUtils::hasText)
                    .distinct()
                    .toList();
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }
}
