package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssetBorrowRequestServiceTest {

    @Mock private AssetBorrowRequestRepository repository;
    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private CurrentUserProvider currentUserProvider;
    @Mock private UsageHistoryService usageHistoryService;
    @Mock private NotificationService notificationService;
    @Mock private AsyncRealtimePushService realtimePushService;
    @Mock private com.poly.mhv.repository.AssetRepository assetRepository;
    @Mock private com.poly.mhv.repository.LocationRepository locationRepository;

    @InjectMocks private AssetBorrowRequestService service;

    @Test
    void approveMarksRequestReservedWithoutCreatingCheckoutImmediately() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").fullName("Admin").build();
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").fullName("Nhân viên").build();
        Location home = Location.builder().id(10).roomName("Kho").build();
        Location destination = Location.builder().id(20).roomName("Phòng 202").build();
        Asset asset = Asset.builder()
                .qaCode("QA0010")
                .name("Máy chiếu")
                .trackingMode("ITEMIZED")
                .location(home)
                .homeLocation(home)
                .build();
        ServiceInquiry inquiry = ServiceInquiry.builder()
                .id(30L)
                .requester(employee)
                .assignee(admin)
                .asset(asset)
                .destinationLocation(destination)
                .status("CONVERTED")
                .build();
        AssetBorrowRequest request = AssetBorrowRequest.builder()
                .id(40L)
                .inquiry(inquiry)
                .asset(asset)
                .requester(employee)
                .approvedBy(admin)
                .destinationLocation(destination)
                .startAt(LocalDateTime.now().plusDays(1))
                .endAt(LocalDateTime.now().plusDays(2))
                .purpose("Họp")
                .status("PENDING")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(40L)).thenReturn(Optional.of(request));
        when(repository.save(any(AssetBorrowRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.approve(40L, BorrowRequestDecisionRequest.builder().note("Duyệt mượn").build());

        verify(usageHistoryService, never()).checkout(any());
        assertThat(request.getStatus()).isEqualTo("RESERVED");
        assertThat(request.getReservedAt()).isNotNull();
        assertThat(request.getCheckedOutAt()).isNull();
        assertThat(inquiry.getStatus()).isEqualTo("CONVERTED");
        assertThat(request.getDecisionNote()).isEqualTo("Duyệt mượn");
    }
}
