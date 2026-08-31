package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.AssetBorrowRequestResponse;
import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.AssetBorrowRequest;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssetBorrowRequestServiceTest {

    @Mock private AssetBorrowRequestRepository repository;
    @Mock private AssetRepository assetRepository;
    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private CurrentUserProvider currentUserProvider;
    @Mock private UsageHistoryService usageHistoryService;
    @Mock private NotificationService notificationService;
    @Mock private AsyncRealtimePushService realtimePushService;

    @InjectMocks private AssetBorrowRequestService service;

    @Test
    void approveRejectsAnotherScheduleThatOverlapsRequestedDates() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").fullName("Admin").build();
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").build();
        Asset asset = Asset.builder().qaCode("MTX0001").name("Laptop").build();
        LocalDate neededFrom = LocalDate.now().plusMonths(1);
        AssetBorrowRequest request = AssetBorrowRequest.builder()
                .id(39L)
                .asset(asset)
                .requester(employee)
                .neededFrom(neededFrom)
                .expectedReturnDate(neededFrom.plusDays(3))
                .status("PENDING")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(39L)).thenReturn(Optional.of(request));
        when(assetRepository.findByQaCodeForUpdate("MTX0001")).thenReturn(Optional.of(asset));
        when(repository.existsOverlappingSchedule(
                org.mockito.ArgumentMatchers.eq("MTX0001"),
                org.mockito.ArgumentMatchers.eq(neededFrom),
                org.mockito.ArgumentMatchers.eq(neededFrom.plusDays(3)),
                any(),
                org.mockito.ArgumentMatchers.eq(39L))).thenReturn(true);

        assertThatThrownBy(() -> service.approve(39L, BorrowRequestDecisionRequest.builder().build()))
                .isInstanceOf(com.poly.mhv.exception.CustomException.class)
                .hasMessageContaining("lịch mượn trùng");
        assertThat(request.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void reservationCannotStartEarlierThanDayBeforeNeedDate() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").fullName("Admin").build();
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").fullName("Nhân viên").build();
        Location destination = Location.builder().id(20).roomName("Phòng 202").build();
        Asset asset = Asset.builder().qaCode("MTX0001").name("Laptop").build();
        LocalDate neededFrom = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
        AssetBorrowRequest request = AssetBorrowRequest.builder()
                .id(40L)
                .asset(asset)
                .requester(employee)
                .destinationLocation(destination)
                .neededFrom(neededFrom)
                .expectedReturnDate(neededFrom.plusDays(1))
                .status("APPROVED")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(40L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> service.reserve(40L, BorrowRequestDecisionRequest.builder().build()))
                .isInstanceOf(com.poly.mhv.exception.CustomException.class)
                .hasMessageContaining("24 giờ trước ngày cần");
        assertThat(request.getStatus()).isEqualTo("APPROVED");
        assertThat(request.getReservationExpiresAt()).isNull();
    }

    @Test
    void reservationDuringAllowedWindowExpiresAtEndOfNeedDate() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").fullName("Admin").build();
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").fullName("Nhân viên").build();
        Location destination = Location.builder().id(20).roomName("Phòng 202").build();
        Asset asset = Asset.builder().qaCode("MTX0001").name("Laptop").build();
        LocalDate neededFrom = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1);
        AssetBorrowRequest request = AssetBorrowRequest.builder()
                .id(41L)
                .asset(asset)
                .requester(employee)
                .destinationLocation(destination)
                .neededFrom(neededFrom)
                .expectedReturnDate(neededFrom.plusDays(1))
                .status("APPROVED")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(41L)).thenReturn(Optional.of(request));
        when(repository.save(any(AssetBorrowRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AssetBorrowRequestResponse response = service.reserve(41L, BorrowRequestDecisionRequest.builder().build());

        LocalDateTime expectedExpiry = neededFrom.plusDays(1)
                .atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh"))
                .withZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();
        assertThat(request.getStatus()).isEqualTo("RESERVED");
        assertThat(request.getReservationExpiresAt()).isEqualTo(expectedExpiry);
        assertThat(response.getReservationExpiresAt()).isEqualTo(expectedExpiry.atOffset(ZoneOffset.UTC));
    }

    @Test
    void handoverCreatesActualCheckoutAndWaitsForEmployeeReceiptConfirmation() {
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
                .neededFrom(LocalDate.now())
                .expectedReturnDate(LocalDate.now().plusDays(1))
                .purpose("Họp")
                .status("APPROVED")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(40L)).thenReturn(Optional.of(request));
        when(repository.save(any(AssetBorrowRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.handover(40L);

        verify(usageHistoryService).checkout(any());
        assertThat(request.getStatus()).isEqualTo("CHECKED_OUT");
        assertThat(request.getCheckedOutAt()).isNotNull();
        assertThat(inquiry.getStatus()).isEqualTo("WAITING_EMPLOYEE");
        assertThat(inquiry.getCompletedAt()).isNull();
        assertThat(inquiry.getDecisionNote()).contains("chờ nhân viên xác nhận");
    }

    @Test
    void handoverCannotOccurBeforeNeedDate() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").fullName("Admin").build();
        AppUser employee = AppUser.builder().id(2).username("employee").role("NhanVien").build();
        Location destination = Location.builder().id(20).roomName("Phòng 202").build();
        Asset asset = Asset.builder().qaCode("MTX0001").name("Laptop").build();
        AssetBorrowRequest request = AssetBorrowRequest.builder()
                .id(42L)
                .asset(asset)
                .requester(employee)
                .destinationLocation(destination)
                .neededFrom(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3))
                .expectedReturnDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(5))
                .status("APPROVED")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(repository.findForUpdateById(42L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> service.handover(42L))
                .isInstanceOf(com.poly.mhv.exception.CustomException.class)
                .hasMessageContaining("từ ngày cần");
        assertThat(request.getStatus()).isEqualTo("APPROVED");
    }
}
