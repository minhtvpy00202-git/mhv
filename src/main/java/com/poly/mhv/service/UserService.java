package com.poly.mhv.service;

import com.poly.mhv.dto.auth.RegisterRequest;
import com.poly.mhv.dto.user.UserAdminRequest;
import com.poly.mhv.dto.user.UserAdminResponse;
import com.poly.mhv.dto.user.UserOptionResponse;
import com.poly.mhv.dto.user.UserPageResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;

    public UserService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            NotificationService notificationService
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.notificationService = notificationService;
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
        AppUser appUser = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode(request.getPassword()))
                .role("NhanVien")
                .fullName(request.getFullName().trim())
                .birthday(request.getBirthday())
                .phone(request.getPhone().trim())
                .status("Hoạt động")
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
    public UserPageResponse getUsers(int page, int size, String keyword, String role, String status) {
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(normalizedPage, normalizedSize);
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedRole = StringUtils.hasText(role) ? role.trim() : null;
        String normalizedStatus = StringUtils.hasText(status) ? status.trim() : null;
        Page<AppUser> result = appUserRepository.searchForAdmin(normalizedKeyword, normalizedRole, normalizedStatus, pageable);
        return UserPageResponse.builder()
                .items(result.getContent().stream().map(this::mapToResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalPages(Math.max(1, result.getTotalPages()))
                .totalItems(result.getTotalElements())
                .build();
    }

    @Transactional
    public UserAdminResponse createUser(UserAdminRequest request) {
        validateForCreate(request);
        String username = request.getUsername().trim();
        if (appUserRepository.existsByUsername(username)) {
            throw new CustomException("Tên đăng nhập đã tồn tại, vui lòng chọn tên đăng nhập khác");
        }
        AppUser appUser = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(validateRole(request.getRole()))
                .fullName(request.getFullName().trim())
                .birthday(request.getBirthday())
                .phone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null)
                .status(validateStatus(request.getStatus()))
                .build();
        AppUser saved = appUserRepository.save(appUser);
        String actor = getCurrentUsername();
        notificationService.createNotification(
                "USER_CREATE",
                "Tạo tài khoản",
                actor + " đã tạo tài khoản " + saved.getUsername() + ".",
                actor,
                null,
                saved.getFullName(),
                Map.of(
                        "Username", saved.getUsername(),
                        "Họ tên", saved.getFullName(),
                        "Vai trò", saved.getRole(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actor
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
        appUser.setBirthday(request.getBirthday());
        appUser.setPhone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null);
        appUser.setRole(validateRole(request.getRole()));
        appUser.setStatus(validateStatus(request.getStatus()));
        if (StringUtils.hasText(request.getPassword())) {
            appUser.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        AppUser saved = appUserRepository.save(appUser);
        String actor = getCurrentUsername();
        notificationService.createNotification(
                "USER_UPDATE",
                "Cập nhật tài khoản",
                actor + " đã cập nhật tài khoản " + saved.getUsername() + ".",
                actor,
                null,
                saved.getFullName(),
                Map.of(
                        "Username", saved.getUsername(),
                        "Họ tên", saved.getFullName(),
                        "Vai trò", saved.getRole(),
                        "Trạng thái", saved.getStatus(),
                        "Người thực hiện", actor
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
        String actor = getCurrentUsername();
        appUserRepository.delete(appUser);
        notificationService.createNotification(
                "USER_DELETE",
                "Xóa tài khoản",
                actor + " đã xóa tài khoản " + appUser.getUsername() + ".",
                actor,
                null,
                appUser.getFullName() == null ? appUser.getUsername() : appUser.getFullName(),
                Map.of(
                        "Username", appUser.getUsername(),
                        "Họ tên", appUser.getFullName() == null ? "" : appUser.getFullName(),
                        "Người thực hiện", actor
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
        return UserAdminResponse.builder()
                .id(appUser.getId())
                .username(appUser.getUsername())
                .role(appUser.getRole())
                .fullName(appUser.getFullName())
                .birthday(appUser.getBirthday())
                .phone(appUser.getPhone())
                .status(appUser.getStatus())
                .build();
    }

    private String validateRole(String role) {
        if (!StringUtils.hasText(role)) {
            throw new CustomException("Vai trò là bắt buộc.");
        }
        String normalizedRole = role.trim();
        if (!"Admin".equals(normalizedRole) && !"NhanVien".equals(normalizedRole)) {
            throw new CustomException("Vai trò không hợp lệ.");
        }
        return normalizedRole;
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

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "system";
        }
        return authentication.getName();
    }
}
