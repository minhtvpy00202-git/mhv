package com.poly.mhv.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.category.CategoryCreateRequest;
import com.poly.mhv.dto.category.CategoryOptionResponse;
import com.poly.mhv.dto.category.CategoryResponse;
import com.poly.mhv.dto.category.CategorySummaryRow;
import com.poly.mhv.dto.category.CategorySummaryResponse;
import com.poly.mhv.dto.category.CategoryUpdateRequest;
import com.poly.mhv.entity.AppUser;
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
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CategoryService {

    private static final long CATEGORY_OPTIONS_CACHE_TTL_MS = 60_000L;
    private static final String CATEGORY_KIND_ITEMIZED = "ITEMIZED";
    private static final String CATEGORY_KIND_CONSUMABLE = "CONSUMABLE";

    private final CategoryRepository categoryRepository;
    private final TechSupportTypeRepository techSupportTypeRepository;
    private final AssetRepository assetRepository;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;
    private volatile List<CategoryOptionResponse> cachedCategoryOptions;
    private volatile long cachedCategoryOptionsExpiresAt;

    public CategoryService(
            CategoryRepository categoryRepository,
            TechSupportTypeRepository techSupportTypeRepository,
            AssetRepository assetRepository,
            ObjectMapper objectMapper,
            NotificationService notificationService,
            CurrentUserProvider currentUserProvider
    ) {
        this.categoryRepository = categoryRepository;
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.assetRepository = assetRepository;
        this.objectMapper = objectMapper;
        this.notificationService = notificationService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<CategorySummaryResponse> getAllCategories(String keyword, Integer techTypeId, String categoryKind) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedCategoryKind = StringUtils.hasText(categoryKind)
                ? normalizeCategoryKind(categoryKind)
                : null;
        return categoryRepository.searchForAdmin(normalizedKeyword, techTypeId, normalizedCategoryKind).stream()
                .map(this::mapToSummaryResponse)
                .toList();
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
        String categoryKind = normalizeCategoryKind(request.getCategoryKind());
        if (categoryRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new CustomException("Tên " + getCategoryLabel(categoryKind) + " đã tồn tại.");
        }
        String generatedCodePrefix = generateCodePrefix(normalizedName);

        Category category = Category.builder()
                .name(normalizedName)
                .codePrefix(generatedCodePrefix)
                .categoryKind(categoryKind)
                .techSupportType(resolveTechSupportType(request.getTechTypeId(), categoryKind))
                .specTemplates(normalizeSpecTemplates(request.getSpecTemplates()))
                .build();
        Category saved = categoryRepository.save(category);
        CategoryResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CATEGORY_CREATE",
                "Tạo " + getCategoryTitle(categoryKind),
                actorDisplayName + " đã tạo " + getCategoryLabel(categoryKind) + " " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        getCategoryTitle(categoryKind), saved.getName(),
                        "Mã tiền tố", saved.getCodePrefix(),
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateCategoryOptionsCache();
        return response;
    }

    @Transactional
    public CategoryResponse updateCategory(Integer id, CategoryUpdateRequest request) {
        Category category = getCategoryOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        String categoryKind = normalizeCategoryKind(request.getCategoryKind());
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên " + getCategoryLabel(categoryKind) + " đã tồn tại.");
        }
        validateCategoryKindChange(category, categoryKind);

        category.setName(normalizedName);
        category.setCategoryKind(categoryKind);
        category.setTechSupportType(resolveTechSupportType(request.getTechTypeId(), categoryKind));
        category.setSpecTemplates(normalizeSpecTemplates(request.getSpecTemplates()));
        Category saved = categoryRepository.save(category);
        CategoryResponse response = mapToResponse(saved);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "CATEGORY_UPDATE",
                "Cập nhật " + getCategoryTitle(categoryKind),
                actorDisplayName + " đã cập nhật " + getCategoryLabel(categoryKind) + " " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        getCategoryTitle(categoryKind), saved.getName(),
                        "Mã tiền tố", saved.getCodePrefix(),
                        "Người thực hiện", actorDisplayName
                )
        );
        invalidateCategoryOptionsCache();
        return response;
    }

    @Transactional
    public void deleteCategory(Integer id) {
        Category category = getCategoryOrThrow(id);
        long linkedAssets = assetRepository.countByCategoryId(id);
        if (linkedAssets > 0) {
            throw new CustomException("Không thể xóa " + getCategoryLabel(category.getCategoryKind()) + " đang được gán cho " + linkedAssets + " tài sản hoặc vật tư.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        categoryRepository.delete(category);
        String categoryKind = normalizeCategoryKind(category.getCategoryKind());
        notificationService.createNotification(
                "CATEGORY_DELETE",
                "Xóa " + getCategoryTitle(categoryKind),
                actorDisplayName + " đã xóa " + getCategoryLabel(categoryKind) + " " + category.getName() + ".",
                actor.getUsername(),
                null,
                category.getName(),
                Map.of(
                        getCategoryTitle(categoryKind), category.getName(),
                        "Mã tiền tố", category.getCodePrefix(),
                        "Người thực hiện", actorDisplayName
                )
        );
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

    private TechSupportType resolveTechSupportType(Integer techTypeId, String categoryKind) {
        if (CATEGORY_KIND_CONSUMABLE.equals(categoryKind)) {
            return null;
        }
        if (techTypeId == null || techTypeId <= 0) {
            throw new CustomException("Nhóm kỹ thuật phụ trách là bắt buộc cho loại thiết bị.");
        }
        return getTechSupportTypeOrThrow(techTypeId);
    }

    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên loại danh mục là bắt buộc.");
        }
        return normalizedName;
    }

    private String normalizeCategoryKind(String categoryKind) {
        if (!StringUtils.hasText(categoryKind)) {
            return CATEGORY_KIND_ITEMIZED;
        }
        String normalized = categoryKind.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORY_KIND_ITEMIZED.equals(normalized) && !CATEGORY_KIND_CONSUMABLE.equals(normalized)) {
            throw new CustomException("Loại category không hợp lệ.");
        }
        return normalized;
    }

    private void validateCategoryKindChange(Category category, String nextCategoryKind) {
        String currentCategoryKind = normalizeCategoryKind(category.getCategoryKind());
        if (currentCategoryKind.equals(nextCategoryKind)) {
            return;
        }
        long linkedAssets = assetRepository.countByCategoryId(category.getId());
        if (linkedAssets > 0) {
            throw new CustomException("Không thể đổi loại danh mục khi đã có tài sản hoặc vật tư sử dụng danh mục này.");
        }
    }

    private String generateCodePrefix(String categoryName) {
        List<String> meaningfulWords = extractMeaningfulWords(categoryName);
        if (meaningfulWords.isEmpty()) {
            throw new CustomException("Không thể sinh mã tiền tố cho loại danh mục này.");
        }

        Set<String> candidates = new LinkedHashSet<>();
        int prefixLength = Math.min(3, meaningfulWords.size());
        collectPrefixCandidates(meaningfulWords, 0, prefixLength, new StringBuilder(), candidates);

        for (String candidate : candidates) {
            if (!categoryRepository.existsByCodePrefixIgnoreCase(candidate)) {
                return candidate;
            }
        }

        throw new CustomException("Không thể sinh mã tiền tố duy nhất cho loại danh mục này.");
    }

    private List<String> extractMeaningfulWords(String categoryName) {
        String normalizedCategoryName = normalizeKeyword(categoryName);
        if (normalizedCategoryName == null) {
            throw new CustomException("Tên loại danh mục không hợp lệ.");
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
        TechSupportType techSupportType = category.getTechSupportType();
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .codePrefix(category.getCodePrefix())
                .categoryKind(normalizeCategoryKind(category.getCategoryKind()))
                .techTypeId(techSupportType != null ? techSupportType.getId() : null)
                .techTypeName(techSupportType != null ? techSupportType.getName() : null)
                .specTemplates(parseSpecTemplates(category.getSpecTemplates()))
                .build();
    }

    private CategorySummaryResponse mapToSummaryResponse(CategorySummaryRow row) {
        List<String> specTemplates = parseSpecTemplates(row.getSpecTemplatesJson());
        return CategorySummaryResponse.builder()
                .id(row.getId())
                .name(row.getName())
                .categoryKind(normalizeCategoryKind(row.getCategoryKind()))
                .techTypeId(row.getTechTypeId())
                .techTypeName(row.getTechTypeName())
                .specTemplates(specTemplates)
                .specTemplateCount(specTemplates.size())
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

    private String getActorDisplayName(AppUser actor) {
        if (actor == null) {
            return "Hệ thống";
        }
        if (StringUtils.hasText(actor.getFullName())) {
            return actor.getFullName().trim();
        }
        return actor.getUsername();
    }

    private String getCategoryLabel(String categoryKind) {
        return CATEGORY_KIND_CONSUMABLE.equals(normalizeCategoryKind(categoryKind))
                ? "loại vật tư"
                : "loại thiết bị";
    }

    private String getCategoryTitle(String categoryKind) {
        return CATEGORY_KIND_CONSUMABLE.equals(normalizeCategoryKind(categoryKind))
                ? "Loại vật tư"
                : "Loại thiết bị";
    }
}
