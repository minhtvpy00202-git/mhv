package com.poly.mhv.service;

import com.poly.mhv.dto.techsupporttype.TechSupportTypeCreateRequest;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeOptionResponse;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeResponse;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeUpdateRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TechSupportTypeService {

    private final TechSupportTypeRepository techSupportTypeRepository;
    private final CategoryRepository categoryRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;

    // Tiêm repository và service phụ trợ cần cho nghiệp vụ loại kỹ thuật viên.
    public TechSupportTypeService(
            TechSupportTypeRepository techSupportTypeRepository,
            CategoryRepository categoryRepository,
            AppUserRepository appUserRepository,
            NotificationService notificationService,
            CurrentUserProvider currentUserProvider
    ) {
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.categoryRepository = categoryRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    // Lấy danh sách loại kỹ thuật viên kèm số liệu tổng hợp cho màn quản trị.
    public List<TechSupportTypeResponse> getAll(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return techSupportTypeRepository.searchSummaryForAdmin(normalizedKeyword);
    }

    @Transactional(readOnly = true)
    // Lấy danh sách rút gọn để dùng ở dropdown chọn chuyên môn.
    public List<TechSupportTypeOptionResponse> getOptions(String keyword) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return techSupportTypeRepository.searchForAdmin(normalizedKeyword).stream()
                .map(type -> TechSupportTypeOptionResponse.builder()
                        .id(type.getId())
                        .name(type.getName())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    // Lấy chi tiết một loại kỹ thuật viên theo id sau khi kiểm tra hợp lệ.
    public TechSupportTypeResponse getById(Integer id) {
        return mapToResponse(getManageableTypeOrThrow(id));
    }

    @Transactional
    // Tạo loại kỹ thuật viên mới và phát thông báo cho hệ thống.
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
        TechSupportType saved = techSupportTypeRepository.save(techSupportType);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "TECH_SUPPORT_TYPE_CREATE",
                "Tạo nhóm kỹ thuật",
                actorDisplayName + " đã tạo nhóm kỹ thuật " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        "Nhóm kỹ thuật", saved.getName(),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToResponse(saved);
    }

    @Transactional
    // Cập nhật tên loại kỹ thuật viên và ghi nhận thông báo thay đổi.
    public TechSupportTypeResponse update(Integer id, TechSupportTypeUpdateRequest request) {
        TechSupportType techSupportType = getManageableTypeOrThrow(id);
        String normalizedName = normalizeName(request.getName());
        if (techSupportTypeRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new CustomException("Tên loại kỹ thuật viên đã tồn tại.");
        }
        techSupportType.setName(normalizedName);
        TechSupportType saved = techSupportTypeRepository.save(techSupportType);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "TECH_SUPPORT_TYPE_UPDATE",
                "Cập nhật nhóm kỹ thuật",
                actorDisplayName + " đã cập nhật nhóm kỹ thuật " + saved.getName() + ".",
                actor.getUsername(),
                null,
                saved.getName(),
                Map.of(
                        "Nhóm kỹ thuật", saved.getName(),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToResponse(saved);
    }

    @Transactional
    // Xóa loại kỹ thuật viên nếu chưa bị gán cho loại thiết bị hoặc tài khoản nào.
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
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        techSupportTypeRepository.delete(techSupportType);
        notificationService.createNotification(
                "TECH_SUPPORT_TYPE_DELETE",
                "Xóa nhóm kỹ thuật",
                actorDisplayName + " đã xóa nhóm kỹ thuật " + techSupportType.getName() + ".",
                actor.getUsername(),
                null,
                techSupportType.getName(),
                Map.of(
                        "Nhóm kỹ thuật", techSupportType.getName(),
                        "Người thực hiện", actorDisplayName
                )
        );
    }

    // Tìm bản ghi theo id và ném lỗi nếu id không hợp lệ hoặc không tồn tại.
    private TechSupportType getManageableTypeOrThrow(Integer id) {
        if (id == null || id <= 0) {
            throw new CustomException("Không tìm thấy loại kỹ thuật viên.");
        }
        return techSupportTypeRepository.findManageableById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy loại kỹ thuật viên với id: " + id));
    }

    // Chuẩn hóa và kiểm tra tên loại kỹ thuật viên trước khi ghi xuống database.
    private String normalizeName(String name) {
        String normalizedName = name == null ? null : name.trim();
        if (!StringUtils.hasText(normalizedName)) {
            throw new CustomException("Tên loại kỹ thuật viên là bắt buộc.");
        }
        return normalizedName;
    }

    // Chuyển entity sang response đầy đủ bằng cách tự tính các số liệu liên quan.
    private TechSupportTypeResponse mapToResponse(TechSupportType techSupportType) {
        return mapToResponse(
                techSupportType,
                Map.of(techSupportType.getId(), categoryRepository.countByTechSupportTypeId(techSupportType.getId())),
                Map.of(techSupportType.getId(), appUserRepository.countUsersByTechSupportTypeId(techSupportType.getId()))
        );
    }

    // Dựng response từ entity và các bộ đếm đã được chuẩn bị sẵn.
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

    // Chọn tên hiển thị phù hợp cho người thực hiện để ghi log và thông báo.
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
