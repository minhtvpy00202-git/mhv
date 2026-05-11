package com.poly.mhv.config;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.repository.TechSupportTypeRepository;
import com.poly.mhv.repository.AppUserRepository;
import java.util.Map;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final TechSupportTypeRepository techSupportTypeRepository;

    public DatabaseSeeder(AppUserRepository appUserRepository, PasswordEncoder passwordEncoder, TechSupportTypeRepository techSupportTypeRepository) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.techSupportTypeRepository = techSupportTypeRepository;
    }

    @Override
    public void run(String... args) {
        seedTechSupportTypes();
        upsertDemoUser("admin", "123456", "Admin");
        upsertDemoUser("nhanvien", "123456", "NhanVien");
        upsertTechSupportUser("techsup1", "123456", 1, "Kỹ thuật viên công nghệ");
        upsertTechSupportUser("techsup2", "123456", 2, "Kỹ thuật viên thiết bị giảng dạy");
        upsertTechSupportUser("techsup3", "123456", 3, "Kỹ thuật viên thiết bị thí nghiệm");
        upsertTechSupportUser("techsup4", "123456", 4, "Kỹ thuật viên thiết bị thể dục thể thao");
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

    private void upsertDemoUser(String username, String rawPassword, String role) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElse(AppUser.builder().username(username).build());

        boolean passwordMatched = passwordEncoder.matches(rawPassword, appUser.getPassword() == null ? "" : appUser.getPassword());
        if (!passwordMatched) {
            appUser.setPassword(passwordEncoder.encode(rawPassword));
        }
        appUser.setRole(role);
        appUser.setStatus("Hoạt động");
        appUser.setTechSupportType(
                techSupportTypeRepository.findById(0)
                        .orElseThrow(() -> new IllegalStateException("Thiếu nhóm kỹ thuật mặc định id=0"))
        );
        if (appUser.getFullName() == null || appUser.getFullName().isBlank()) {
            appUser.setFullName(username);
        }
        appUserRepository.save(appUser);
    }

    private void upsertTechSupportUser(String username, String rawPassword, Integer techTypeId, String fullName) {
        AppUser appUser = appUserRepository.findByUsername(username)
                .orElse(AppUser.builder().username(username).build());

        boolean passwordMatched = passwordEncoder.matches(rawPassword, appUser.getPassword() == null ? "" : appUser.getPassword());
        if (!passwordMatched) {
            appUser.setPassword(passwordEncoder.encode(rawPassword));
        }
        appUser.setRole("TechSupport");
        appUser.setStatus("Hoạt động");
        appUser.setFullName(fullName);
        appUser.setTechSupportType(
                techSupportTypeRepository.findById(techTypeId)
                        .orElseThrow(() -> new IllegalStateException("Thiếu nhóm kỹ thuật id=" + techTypeId))
        );
        appUserRepository.save(appUser);
    }
}
