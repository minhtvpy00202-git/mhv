package com.poly.mhv.config;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.repository.TechSupportTypeRepository;
import com.poly.mhv.repository.AppUserRepository;
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
        upsertDemoUser("admin", "password123", "Admin");
        upsertDemoUser("nhanvien", "password123", "NhanVien");
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
        techSupportTypeRepository.findById(0).ifPresent(appUser::setTechSupportType);
        if (appUser.getFullName() == null || appUser.getFullName().isBlank()) {
            appUser.setFullName(username);
        }
        appUserRepository.save(appUser);
    }
}
