package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.ServiceInquiryRepository;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InquirySlaReminderSchedulerTest {

    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private NotificationService notificationService;
    @Mock private AsyncRealtimePushService realtimePushService;
    @Mock private InquiryWorkflowSettingService workflowSettingService;

    @InjectMocks private InquirySlaReminderScheduler scheduler;

    @Test
    void overdueUnansweredInquiryIsMarkedAndNotified() {
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").build();
        Asset asset = Asset.builder().qaCode("QA001").name("Máy chiếu").build();
        LocalDateTime dueAt = LocalDateTime.now().minusMinutes(20);
        ServiceInquiry inquiry = ServiceInquiry.builder()
                .id(10L)
                .requester(employee)
                .targetRole("Admin")
                .asset(asset)
                .status("NEW")
                .slaResponseDueAt(dueAt)
                .overdueReminderCount(0)
                .build();
        when(inquiryRepository.findResponseSlaOverdue(any(), anyCollection())).thenReturn(List.of(inquiry));
        when(workflowSettingService.getEffectiveSettings()).thenReturn(
                new InquiryWorkflowSettingService.EffectiveSettings(
                        30, 45, 24, 20, new BigDecimal("5000000")));

        scheduler.remindOverdueResponses();

        verify(notificationService).createNotification(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyMap(), anyCollection());
        verify(inquiryRepository).save(inquiry);
        assertThat(inquiry.getSlaBreachedAt()).isEqualTo(dueAt);
        assertThat(inquiry.getLastOverdueReminderAt()).isNotNull();
        assertThat(inquiry.getOverdueReminderCount()).isEqualTo(1);
    }
}
