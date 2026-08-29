package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingRequest;
import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InquiryWorkflowSetting;
import com.poly.mhv.repository.InquiryWorkflowSettingRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InquiryWorkflowSettingServiceTest {

    @Mock private InquiryWorkflowSettingRepository repository;
    @Mock private CurrentUserProvider currentUserProvider;

    @InjectMocks private InquiryWorkflowSettingService service;

    @Test
    void effectiveSettingsUseSafeDefaultsBeforeAdminSavesConfiguration() {
        when(repository.findById(1)).thenReturn(Optional.empty());

        InquiryWorkflowSettingService.EffectiveSettings settings = service.getEffectiveSettings();

        assertThat(settings.assetResponseSlaMinutes()).isEqualTo(30);
        assertThat(settings.consumableResponseSlaMinutes()).isEqualTo(45);
        assertThat(settings.overdueReminderIntervalHours()).isEqualTo(24);
        assertThat(settings.largeQuantityThreshold()).isEqualTo(20);
        assertThat(settings.highValueThreshold()).isEqualByComparingTo("5000000");
    }

    @Test
    void adminCanPersistWorkflowSettings() {
        AppUser admin = AppUser.builder()
                .id(9)
                .username("admin")
                .fullName("Quản trị viên")
                .role("Admin")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findById(1)).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        InquiryWorkflowSettingRequest request = InquiryWorkflowSettingRequest.builder()
                .assetResponseSlaMinutes(20)
                .consumableResponseSlaMinutes(35)
                .overdueReminderIntervalHours(6)
                .largeQuantityThreshold(50)
                .highValueThreshold(new BigDecimal("10000000"))
                .build();

        InquiryWorkflowSettingResponse response = service.update(request);

        assertThat(response.getLargeQuantityThreshold()).isEqualTo(50);
        assertThat(response.getHighValueThreshold()).isEqualByComparingTo("10000000");
        assertThat(response.getUpdatedByUserId()).isEqualTo(9);
        assertThat(response.getUpdatedAt()).isNotNull();
    }
}
