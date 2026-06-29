package com.poly.mhv.service;

import com.poly.mhv.dto.auth.RegisterRequest;
import com.poly.mhv.dto.user.UserAdminRequest;
import com.poly.mhv.dto.user.UserAdminResponse;
import com.poly.mhv.dto.user.UserOptionResponse;
import com.poly.mhv.dto.user.UserPageResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;
    private final TechSupportTypeRepository techSupportTypeRepository;
    private final CurrentUserProvider currentUserProvider;

    public UserService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            NotificationService notificationService,
            TechSupportTypeRepository techSupportTypeRepository,
            CurrentUserProvider currentUserProvider
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.notificationService = notificationService;
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public boolean existsByUsername(String username) {
        if (!StringUtils.hasText(username)) {
            return false;
        }
        return appUserRepository.existsByUsername(username.trim());
    }

    @Transactional
    public UserAdminResponse register(RegisterRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu đăng ký không được để trống.");
        }
        if (!StringUtils.hasText(request.getUsername())) {
            throw new CustomException("username là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new CustomException("password là bắt buộc.");
        }
        String username = request.getUsername().trim();
        if (appUserRepository.existsByUsername(username)) {
            throw new CustomException("Tên đăng nhập đã tồn tại, vui lòng chọn tên đăng nhập khác");
        }
        String normalizedEmail = normalizeEmail(request.getEmail());
        validateEmailUniqueness(normalizedEmail, null);
        AppUser appUser = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode(request.getPassword()))
                .role("NhanVien")
                .fullName(request.getFullName().trim())
                .email(normalizedEmail)
                .birthday(request.getBirthday())
                .phone(request.getPhone().trim())
                .status("Hoạt động")
                .techSupportTypes(new ArrayList<>())
                .build();
        AppUser saved = appUserRepository.save(appUser);
        notificationService.createNotification(
                "USER_REGISTER",
                "Đăng ký tài khoản",
                "Người dùng " + saved.getUsername() + " vừa đăng ký tài khoản.",
                saved.getUsername(),
                null,
                saved.getFullName(),
                Map.of(
                        "Username", saved.getUsername(),
                        "Họ tên", saved.getFullName(),
                        "Vai trò", saved.getRole()
                )
        );
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<UserOptionResponse> getBorrowers() {
        return appUserRepository.findAllByOrderByUsernameAsc().stream()
                .filter(user -> "Hoạt động".equals(user.getStatus()))
                .map(user -> UserOptionResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserAdminResponse> getTechSupportUsers() {
        List<AppUser> techSupportUsers = appUserRepository.findByRole("TechSupport");
        List<Integer> userIds = techSupportUsers.stream()
                .map(AppUser::getId)
                .toList();
        Map<Integer, AppUser> usersById = userIds.isEmpty()
                ? Map.of()
                : appUserRepository.findAllWithTechSupportTypesByIdIn(userIds).stream()
                        .collect(Collectors.toMap(AppUser::getId, Function.identity()));
        return techSupportUsers.stream()
                .map(user -> mapToResponse(usersById.getOrDefault(user.getId(), user)))
                .toList();
    }

    @Transactional(readOnly = true)
    public UserPageResponse getUsers(int page, int size, String keyword, String role, String status) {
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.max(1, Math.min(size, 100));
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedRole = normalizeRoleValue(role);
        String normalizedStatus = StringUtils.hasText(status) ? status.trim() : null;
        Page<AppUser> userPage = appUserRepository.searchForAdmin(
                normalizedKeyword,
                normalizedRole,
                normalizedStatus,
                PageRequest.of(normalizedPage, normalizedSize)
        );
        List<Integer> userIds = userPage.getContent().stream()
                .map(AppUser::getId)
                .toList();
        Map<Integer, AppUser> usersById = userIds.isEmpty()
                ? Map.of()
                : appUserRepository.findAllWithTechSupportTypesByIdIn(userIds).stream()
                        .collect(Collectors.toMap(AppUser::getId, Function.identity()));
        return UserPageResponse.builder()
                .items(userPage.getContent().stream()
                        .map(user -> mapToResponse(usersById.getOrDefault(user.getId(), user)))
                        .toList())
                .page(userPage.getNumber())
                .size(userPage.getSize())
                .totalPages(Math.max(1, userPage.getTotalPages()))
                .totalItems(userPage.getTotalElements())
                .build();
    }

    @Transactional
    public UserAdminResponse createUser(UserAdminRequest request) {
        validateForCreate(request);
        String username = request.getUsername().trim();
        if (appUserRepository.existsByUsername(username)) {
            throw new CustomException("Tên đăng nhập đã tồn tại, vui lòng chọn tên đăng nhập khác");
        }
        String validatedRole = validateRole(request.getRole());
        List<TechSupportType> techSupportTypes = resolveTechSupportTypes(validatedRole, request);
        AppUser appUser = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(validatedRole)
                .fullName(request.getFullName().trim())
                .email(validateEmailForWrite(request.getEmail(), null))
                .birthday(request.getBirthday())
                .phone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null)
                .status(validateStatus(request.getStatus()))
                .techSupportTypes(new ArrayList<>(techSupportTypes))
                .build();
        AppUser saved = appUserRepository.save(appUser);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "USER_CREATE",
                "Tạo tài khoản",
                actorDisplayName + " đã tạo tài khoản " + saved.getUsername() + ".",
                actor.getUsername(),
                null,
                saved.getUsername(),
                Map.of(
                        "Username", saved.getUsername(),
                        "Họ tên", saved.getFullName(),
                        "Vai trò", saved.getRole(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToResponse(saved);
    }

    @Transactional
    public UserAdminResponse updateUser(Integer id, UserAdminRequest request) {
        if (id == null) {
            throw new CustomException("id là bắt buộc.");
        }
        if (request == null) {
            throw new CustomException("Dữ liệu cập nhật không được để trống.");
        }
        AppUser appUser = appUserRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy người dùng."));
        if (!StringUtils.hasText(request.getFullName())) {
            throw new CustomException("Họ tên là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getRole())) {
            throw new CustomException("Vai trò là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getStatus())) {
            throw new CustomException("Trạng thái là bắt buộc.");
        }
        if (StringUtils.hasText(request.getUsername())) {
            String username = request.getUsername().trim();
            if (!username.equalsIgnoreCase(appUser.getUsername()) && appUserRepository.existsByUsername(username)) {
                throw new CustomException("Tên đăng nhập đã tồn tại, vui lòng chọn tên đăng nhập khác");
            }
            appUser.setUsername(username);
        }
        appUser.setFullName(request.getFullName().trim());
        appUser.setEmail(validateEmailForWrite(request.getEmail(), appUser.getId()));
        appUser.setBirthday(request.getBirthday());
        appUser.setPhone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null);
        String validatedRole = validateRole(request.getRole());
        List<TechSupportType> techSupportTypes = resolveTechSupportTypes(validatedRole, request);
        appUser.setRole(validatedRole);
        appUser.setTechSupportTypes(new ArrayList<>(techSupportTypes));
        appUser.setStatus(validateStatus(request.getStatus()));
        if (StringUtils.hasText(request.getPassword())) {
            appUser.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        AppUser saved = appUserRepository.save(appUser);
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        notificationService.createNotification(
                "USER_UPDATE",
                "Cập nhật tài khoản",
                actorDisplayName + " đã cập nhật tài khoản " + saved.getUsername() + ".",
                actor.getUsername(),
                null,
                saved.getUsername(),
                Map.of(
                        "Username", saved.getUsername(),
                        "Họ tên", saved.getFullName(),
                        "Vai trò", saved.getRole(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actorDisplayName
                )
        );
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteUser(Integer id) {
        if (id == null) {
            throw new CustomException("id là bắt buộc.");
        }
        AppUser appUser = appUserRepository.findById(id)
                .orElseThrow(() -> new CustomException("Không tìm thấy người dùng."));
        if ("admin".equalsIgnoreCase(appUser.getUsername())) {
            throw new CustomException("Không thể xóa tài khoản admin mặc định.");
        }
        AppUser actor = currentUserProvider.getCurrentUser();
        String actorDisplayName = getActorDisplayName(actor);
        appUserRepository.delete(appUser);
        notificationService.createNotification(
                "USER_DELETE",
                "Xóa tài khoản",
                actorDisplayName + " đã xóa tài khoản " + appUser.getUsername() + ".",
                actor.getUsername(),
                null,
                appUser.getUsername(),
                Map.of(
                        "Username", appUser.getUsername(),
                        "Họ tên", appUser.getFullName() == null ? "" : appUser.getFullName(),
                        "Người thực hiện", actorDisplayName
                )
        );
    }

    private void validateForCreate(UserAdminRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu tạo tài khoản không được để trống.");
        }
        if (!StringUtils.hasText(request.getUsername())) {
            throw new CustomException("username là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new CustomException("password là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getFullName())) {
            throw new CustomException("Họ tên là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getRole())) {
            throw new CustomException("Vai trò là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getStatus())) {
            throw new CustomException("Trạng thái là bắt buộc.");
        }
        if (request.getBirthday() == null) {
            throw new CustomException("Ngày sinh là bắt buộc.");
        }
        if (!request.getBirthday().isBefore(LocalDate.now())) {
            throw new CustomException("Ngày sinh phải là ngày trong quá khứ.");
        }
        if (!StringUtils.hasText(request.getPhone())) {
            throw new CustomException("Số điện thoại là bắt buộc.");
        }
        String normalizedPhone = request.getPhone().trim();
        if (!normalizedPhone.matches("^0\\d{9}$")) {
            throw new CustomException("Số điện thoại phải gồm đúng 10 số và bắt đầu bằng 0.");
        }
    }

    private UserAdminResponse mapToResponse(AppUser appUser) {
        List<TechSupportType> effectiveTechSupportTypes = getEffectiveTechSupportTypes(appUser);
        List<Integer> techTypeIds = effectiveTechSupportTypes.stream()
                .map(TechSupportType::getId)
                .toList();
        List<String> techTypeNames = effectiveTechSupportTypes.stream()
                .map(TechSupportType::getName)
                .toList();
        return UserAdminResponse.builder()
                .id(appUser.getId())
                .username(appUser.getUsername())
                .role(appUser.getRole())
                .fullName(appUser.getFullName())
                .email(appUser.getEmail())
                .birthday(appUser.getBirthday())
                .phone(appUser.getPhone())
                .status(appUser.getStatus())
                .techTypeIds(techTypeIds)
                .techTypeNames(techTypeNames)
                .build();
    }

    private String validateRole(String role) {
        if (!StringUtils.hasText(role)) {
            throw new CustomException("Vai trò là bắt buộc.");
        }
        String normalizedRole = normalizeRoleValue(role);
        if (normalizedRole == null) {
            throw new CustomException("Vai trò không hợp lệ.");
        }
        return normalizedRole;
    }

    private String normalizeRoleValue(String role) {
        if (!StringUtils.hasText(role)) {
            return null;
        }
        String normalizedRole = role.trim();
        if ("admin".equalsIgnoreCase(normalizedRole)) {
            return "Admin";
        }
        if ("nhanvien".equalsIgnoreCase(normalizedRole)) {
            return "NhanVien";
        }
        if ("consumablemanager".equalsIgnoreCase(normalizedRole) || "quanlycapphat".equalsIgnoreCase(normalizedRole)) {
            return "ConsumableManager";
        }
        if ("techsupport".equalsIgnoreCase(normalizedRole)) {
            return "TechSupport";
        }
        return null;
    }

    private String validateStatus(String status) {
        if (!StringUtils.hasText(status)) {
            throw new CustomException("Trạng thái là bắt buộc.");
        }
        String normalizedStatus = status.trim();
        if (!"Hoạt động".equals(normalizedStatus) && !"Khóa".equals(normalizedStatus)) {
            throw new CustomException("Trạng thái không hợp lệ.");
        }
        return normalizedStatus;
    }

    private String validateEmailForWrite(String email, Integer currentUserId) {
        String normalizedEmail = normalizeEmail(email);
        validateEmailUniqueness(normalizedEmail, currentUserId);
        return normalizedEmail;
    }

    private void validateEmailUniqueness(String normalizedEmail, Integer currentUserId) {
        if (!StringUtils.hasText(normalizedEmail)) {
            return;
        }
        appUserRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(existingUser -> currentUserId == null || !existingUser.getId().equals(currentUserId))
                .ifPresent(existingUser -> {
                    throw new CustomException("Email đã tồn tại, vui lòng dùng email khác.");
                });
    }

    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email)) {
            return null;
        }
        return email.trim().toLowerCase();
    }

    private List<TechSupportType> resolveTechSupportTypes(String role, UserAdminRequest request) {
        if (!"TechSupport".equals(role)) {
            return List.of();
        }
        List<Integer> techTypeIds = extractTechTypeIds(request);
        if (techTypeIds.isEmpty()) {
            throw new CustomException("Kỹ thuật viên phải có ít nhất một chuyên môn kỹ thuật hợp lệ.");
        }
        return techTypeIds.stream()
                .map(this::getTechSupportTypeOrThrow)
                .toList();
    }

    private List<Integer> extractTechTypeIds(UserAdminRequest request) {
        if (request == null) {
            return List.of();
        }
        return request.getTechTypeIds() == null
                ? List.of()
                : request.getTechTypeIds().stream()
                        .filter(id -> id != null && id > 0)
                        .distinct()
                        .toList();
    }

    private TechSupportType getTechSupportTypeOrThrow(Integer techTypeId) {
        return techSupportTypeRepository.findById(techTypeId)
                .orElseThrow(() -> new CustomException("Không tìm thấy loại chuyên môn kỹ thuật."));
    }

    private List<TechSupportType> getEffectiveTechSupportTypes(AppUser appUser) {
        if (appUser.getTechSupportTypes() != null) {
            return appUser.getTechSupportTypes().stream()
                    .filter(type -> type != null && type.getId() != null && type.getId() > 0)
                    .toList();
        }
        return List.of();
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
}
