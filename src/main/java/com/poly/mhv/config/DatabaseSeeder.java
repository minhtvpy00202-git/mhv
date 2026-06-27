package com.poly.mhv.config;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.repository.TechSupportTypeRepository;
import com.poly.mhv.repository.AppUserRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class DatabaseSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final TechSupportTypeRepository techSupportTypeRepository;
    private final boolean demoUsersEnabled;

    public DatabaseSeeder(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            TechSupportTypeRepository techSupportTypeRepository,
            @Value("${app.seed.demo-users.enabled:false}") boolean demoUsersEnabled
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.techSupportTypeRepository = techSupportTypeRepository;
        this.demoUsersEnabled = demoUsersEnabled;
    }

    @Override
    public void run(String... args) {
        seedTechSupportTypes();
        if (!demoUsersEnabled) {
            return;
        }
        upsertDemoUser("admin", "123456", "Admin", "Nguyễn Minh Quân", "admin@mhv.local", LocalDate.of(1990, 5, 12), "0901234567");
        upsertDemoUser("nhanvien", "123456", "NhanVien", "Trần Thu Hà", "nhanvien@mhv.local", LocalDate.of(1998, 9, 23), "0901234568");
        upsertDemoUser("consumable", "123456", "ConsumableManager", "Phan Khánh Linh", "consumable@mhv.local", LocalDate.of(1996, 6, 14), "0901234573");
        upsertTechSupportUser("techsup1", "123456", 1, "Nguyễn Hoàng Anh", "techsup1@mhv.local", LocalDate.of(1994, 3, 18), "0901234569");
        upsertTechSupportUser("techsup2", "123456", 2, "Lê Quỳnh Mai", "techsup2@mhv.local", LocalDate.of(1995, 11, 7), "0901234570");
        upsertTechSupportUser("techsup3", "123456", 3, "Phạm Đức Huy", "techsup3@mhv.local", LocalDate.of(1993, 8, 29), "0901234571");
        upsertTechSupportUser("techsup4", "123456", 4, "Võ Bảo Ngọc", "techsup4@mhv.local", LocalDate.of(1997, 1, 15), "0901234572");
    }

    private void seedTechSupportTypes() {
        Map<Integer, String> requiredTypes = Map.of(
                0, "Không phải TechSupport",
                1, "Kỹ thuật viên công nghệ",
                2, "Kỹ thuật viên thiết bị giảng dạy",
                3, "Kỹ thuật viên thiết bị thí nghiệm",
                4, "Kỹ thuật viên thiết bị thể dục thể thao"
        );
        requiredTypes.forEach((id, name) -> {
            TechSupportType type = techSupportTypeRepository.findById(id)
                    .orElse(TechSupportType.builder().id(id).build());
            type.setName(name);
            techSupportTypeRepository.save(type);
        });
    }

    private void upsertDemoUser(
            String username,
            String rawPassword,
            String role,
            String fullName,
            String email,
            LocalDate birthday,
            String phone
    ) {
        AppUser appUser = appUserRepository.findByUsernameWithTechSupportTypes(username)
                .orElseGet(() -> AppUser.builder()
                        .username(username)
                        .techSupportTypes(new ArrayList<>())
                        .build());

        if (!hasPassword(appUser)) {
            appUser.setPassword(passwordEncoder.encode(rawPassword));
        }
        if (isBlank(appUser.getRole())) {
            appUser.setRole(role);
        }
        if (isBlank(appUser.getStatus())) {
            appUser.setStatus("Hoạt động");
        }
        if (appUser.getTechSupportTypes() == null) {
            appUser.setTechSupportTypes(new ArrayList<>());
        }
        if (isBlank(appUser.getFullName())) {
            appUser.setFullName(fullName);
        }
        if (isBlank(appUser.getEmail())) {
            appUser.setEmail(email);
        }
        if (appUser.getBirthday() == null) {
            appUser.setBirthday(birthday);
        }
        if (isBlank(appUser.getPhone())) {
            appUser.setPhone(phone);
        }
        appUserRepository.save(appUser);
    }

    private void upsertTechSupportUser(
            String username,
            String rawPassword,
            Integer techTypeId,
            String fullName,
            String email,
            LocalDate birthday,
            String phone
    ) {
        AppUser appUser = appUserRepository.findByUsernameWithTechSupportTypes(username)
                .orElseGet(() -> AppUser.builder().username(username).build());

        if (!hasPassword(appUser)) {
            appUser.setPassword(passwordEncoder.encode(rawPassword));
        }
        if (isBlank(appUser.getRole())) {
            appUser.setRole("TechSupport");
        }
        if (isBlank(appUser.getStatus())) {
            appUser.setStatus("Hoạt động");
        }
        if (isBlank(appUser.getFullName())) {
            appUser.setFullName(fullName);
        }
        if (isBlank(appUser.getEmail())) {
            appUser.setEmail(email);
        }
        if (appUser.getBirthday() == null) {
            appUser.setBirthday(birthday);
        }
        if (isBlank(appUser.getPhone())) {
            appUser.setPhone(phone);
        }
        TechSupportType techSupportType = techSupportTypeRepository.findById(techTypeId)
                .orElseThrow(() -> new IllegalStateException("Thiếu nhóm kỹ thuật id=" + techTypeId));
        if (appUser.getTechSupportTypes() == null || appUser.getTechSupportTypes().isEmpty()) {
            appUser.setTechSupportTypes(new ArrayList<>(java.util.List.of(techSupportType)));
        }
        appUserRepository.save(appUser);
    }

    private boolean hasPassword(AppUser appUser) {
        return !isBlank(appUser.getPassword());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
