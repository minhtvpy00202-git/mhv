package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.user.UserChangePasswordRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.TechSupportTypeRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private AppUserRepository appUserRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private NotificationService notificationService;
    @Mock private TechSupportTypeRepository techSupportTypeRepository;
    @Mock private CurrentUserProvider currentUserProvider;

    @InjectMocks private UserService userService;

    @Test
    void changeMyPasswordRejectsIncorrectCurrentPassword() {
        AppUser actor = AppUser.builder()
                .id(7)
                .username("employee")
                .password("$2a$10$oldhash")
                .role("NhanVien")
                .build();
        UserChangePasswordRequest request = UserChangePasswordRequest.builder()
                .currentPassword("wrong-password")
                .newPassword("new-password-123")
                .confirmNewPassword("new-password-123")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(actor);
        when(appUserRepository.findById(7)).thenReturn(Optional.of(actor));
        when(passwordEncoder.matches("wrong-password", "$2a$10$oldhash")).thenReturn(false);

        assertThatThrownBy(() -> userService.changeMyPassword(request))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("Mật khẩu hiện tại không đúng");

        verify(appUserRepository, never()).save(any(AppUser.class));
    }

    @Test
    void changeMyPasswordEncodesAndStoresNewPassword() {
        AppUser actor = AppUser.builder()
                .id(7)
                .username("employee")
                .password("$2a$10$oldhash")
                .role("NhanVien")
                .build();
        UserChangePasswordRequest request = UserChangePasswordRequest.builder()
                .currentPassword("old-password")
                .newPassword("new-password-123")
                .confirmNewPassword("new-password-123")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(actor);
        when(appUserRepository.findById(7)).thenReturn(Optional.of(actor));
        when(passwordEncoder.matches("old-password", "$2a$10$oldhash")).thenReturn(true);
        when(passwordEncoder.matches("new-password-123", "$2a$10$oldhash")).thenReturn(false);
        when(passwordEncoder.encode("new-password-123")).thenReturn("$2a$10$newhash");

        userService.changeMyPassword(request);

        verify(appUserRepository).save(actor);
    }
}
