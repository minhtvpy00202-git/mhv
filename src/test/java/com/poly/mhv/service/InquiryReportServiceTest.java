package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.InquiryReportResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.UtcDateTimes;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InquiryReportServiceTest {

    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private CurrentUserProvider currentUserProvider;

    @InjectMocks private InquiryReportService service;

    @Test
    void reportCalculatesSlaApprovalAndConsumableDemand() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        LocalDateTime base = UtcDateTimes.now().minusHours(3);
        Asset paper = Asset.builder().qaCode("VT001").name("Giấy A4").unit("ram").build();
        Asset projector = Asset.builder().qaCode("QA001").name("Máy chiếu").build();
        ServiceInquiry completed = ServiceInquiry.builder()
                .id(1L).inquiryType("CONSUMABLE_REQUEST").targetRole("ConsumableManager")
                .asset(paper).quantityRequested(5).status("COMPLETED").linkedEntityId(11L)
                .createdAt(base).slaResponseDueAt(base.plusMinutes(45)).firstResponseAt(base.plusMinutes(20)).build();
        ServiceInquiry rejected = ServiceInquiry.builder()
                .id(2L).inquiryType("ASSET_BORROW").targetRole("Admin")
                .asset(projector).quantityRequested(1).status("REJECTED")
                .createdAt(base).slaResponseDueAt(base.plusMinutes(30)).firstResponseAt(base.plusMinutes(60)).build();
        ServiceInquiry overdue = ServiceInquiry.builder()
                .id(3L).inquiryType("ASSET_BORROW").targetRole("Admin")
                .asset(projector).quantityRequested(1).status("NEW")
                .createdAt(base).slaResponseDueAt(base.plusMinutes(30)).build();
        when(inquiryRepository.findForReport(any(), any(), isNull()))
                .thenReturn(List.of(completed, rejected, overdue));

        InquiryReportResponse report = service.getReport(base.toLocalDate(), UtcDateTimes.now().toLocalDate(), null);

        assertThat(report.getTotalRequests()).isEqualTo(3);
        assertThat(report.getCompletedRequests()).isEqualTo(1);
        assertThat(report.getRejectedRequests()).isEqualTo(1);
        assertThat(report.getOpenRequests()).isEqualTo(1);
        assertThat(report.getRespondedRequests()).isEqualTo(2);
        assertThat(report.getResponseSlaBreaches()).isEqualTo(2);
        assertThat(report.getActiveResponseOverdue()).isEqualTo(1);
        assertThat(report.getAverageFirstResponseMinutes()).isEqualTo(40D);
        assertThat(report.getResponseSlaMetRate()).isEqualTo(50D);
        assertThat(report.getApprovalRate()).isEqualTo(50D);
        assertThat(report.getTopConsumableDemand()).singleElement().satisfies(item -> {
            assertThat(item.getAssetQaCode()).isEqualTo("VT001");
            assertThat(item.getTotalQuantityRequested()).isEqualTo(5);
        });
    }
}
