package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.inquiry.InquiryCreateRequest;
import com.poly.mhv.dto.inquiry.InquiryResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.AssetBorrowRequestRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ConsumableInquiryFulfillmentRepository;
import com.poly.mhv.repository.InquiryMessageRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class InquiryServiceTest {

    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private InquiryMessageRepository messageRepository;
    @Mock private AssetBorrowRequestRepository borrowRequestRepository;
    @Mock private AssetRepository assetRepository;
    @Mock private LocationRepository locationRepository;
    @Mock private AppUserRepository appUserRepository;
    @Mock private AreaTypeCatalogRepository areaTypeCatalogRepository;
    @Mock private CurrentUserProvider currentUserProvider;
    @Mock private InquiryMediaStorageService mediaStorageService;
    @Mock private AssetService assetService;
    @Mock private NotificationService notificationService;
    @Mock private AsyncRealtimePushService realtimePushService;
    @Mock private InquiryWorkflowSettingService workflowSettingService;
    @Mock private ConsumableInquiryFulfillmentRepository consumableFulfillmentRepository;

    @InjectMocks private InquiryService inquiryService;

    private AppUser employee;
    private Location homeLocation;
    private Location destination;

    @BeforeEach
    void setUp() {
        employee = AppUser.builder()
                .id(11)
                .username("employee")
                .fullName("Nhân viên A")
                .role("NhanVien")
                .status("Hoạt động")
                .build();
        homeLocation = Location.builder().id(1).roomName("Kho thiết bị").build();
        destination = Location.builder().id(2).roomName("Phòng 202").build();
    }

    @Test
    void createItemizedInquiryRoutesToAdminWithoutChangingAsset() {
        Asset asset = Asset.builder()
                .qaCode("QA0001")
                .name("Máy chiếu")
                .trackingMode("ITEMIZED")
                .status("Sẵn sàng")
                .technicalStatus("Tốt")
                .usageStatus("Tại kho")
                .location(homeLocation)
                .homeLocation(homeLocation)
                .build();
        stubCreate(asset);

        InquiryResponse response = inquiryService.create(requestFor(asset, LocalDate.now().plusDays(2)));

        ArgumentCaptor<ServiceInquiry> captor = ArgumentCaptor.forClass(ServiceInquiry.class);
        verify(inquiryRepository).save(captor.capture());
        assertThat(captor.getValue().getTargetRole()).isEqualTo("Admin");
        assertThat(captor.getValue().getInquiryType()).isEqualTo("ASSET_BORROW");
        assertThat(captor.getValue().getQuantityRequested()).isEqualTo(1);
        assertThat(response.getStatus()).isEqualTo("NEW");
        assertThat(response.getAssetQaCode()).isEqualTo("QA0001");
        assertThat(response.getSlaResponseDueAt()).isAfter(response.getCreatedAt());
        assertThat(java.time.Duration.between(response.getCreatedAt(), response.getSlaResponseDueAt()).toMinutes())
                .isEqualTo(30);
        assertThat(asset.getStatus()).isEqualTo("Sẵn sàng");
        assertThat(asset.getLocation()).isSameAs(homeLocation);
    }

    @Test
    void createConsumableInquiryRoutesToConsumableManagerAndKeepsRequestedQuantity() {
        Asset asset = Asset.builder()
                .qaCode("VT0001")
                .name("Giấy A4")
                .trackingMode("CONSUMABLE")
                .status("Còn hàng")
                .quantityOnHand(50)
                .unit("ram")
                .location(homeLocation)
                .homeLocation(homeLocation)
                .build();
        stubCreate(asset);
        InquiryCreateRequest request = requestFor(asset, null);
        request.setQuantityRequested(4);

        inquiryService.create(request);

        ArgumentCaptor<ServiceInquiry> captor = ArgumentCaptor.forClass(ServiceInquiry.class);
        verify(inquiryRepository).save(captor.capture());
        assertThat(captor.getValue().getTargetRole()).isEqualTo("ConsumableManager");
        assertThat(captor.getValue().getInquiryType()).isEqualTo("CONSUMABLE_REQUEST");
        assertThat(captor.getValue().getQuantityRequested()).isEqualTo(4);
        assertThat(captor.getValue().getExpectedReturnDate()).isNull();
        assertThat(captor.getValue().getApprovalQuantityThreshold()).isEqualTo(20);
        assertThat(captor.getValue().getApprovalValueThreshold()).isEqualByComparingTo("5000000");
        assertThat(java.time.Duration.between(
                captor.getValue().getCreatedAt(),
                captor.getValue().getSlaResponseDueAt()).toMinutes()).isEqualTo(45);
        assertThat(asset.getQuantityOnHand()).isEqualTo(50);
    }

    @Test
    void adminCannotCreateAnEmployeeInquiry() {
        AppUser admin = AppUser.builder().id(1).username("admin").role("Admin").status("Hoạt động").build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        InquiryCreateRequest request = InquiryCreateRequest.builder()
                .assetQaCode("QA0001")
                .destinationLocationId(2)
                .quantityRequested(1)
                .neededFrom(LocalDate.now())
                .expectedReturnDate(LocalDate.now().plusDays(1))
                .purpose("Họp")
                .build();

        assertThatThrownBy(() -> inquiryService.create(request))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Chỉ nhân viên");
    }

    @Test
    void adminCanClaimAnItemizedInquiry() {
        AppUser admin = AppUser.builder()
                .id(1)
                .username("admin")
                .fullName("Quản trị viên")
                .role("Admin")
                .status("Hoạt động")
                .build();
        ServiceInquiry inquiry = pendingItemizedInquiry();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(inquiryRepository.findForUpdateById(99L)).thenReturn(Optional.of(inquiry));
        when(inquiryRepository.save(inquiry)).thenReturn(inquiry);
        when(messageRepository.countUnread(99L, admin.getId())).thenReturn(0L);

        InquiryResponse response = inquiryService.claim(99L);

        assertThat(response.getAssigneeId()).isEqualTo(admin.getId());
        assertThat(response.getStatus()).isEqualTo("CLAIMED");
        assertThat(inquiry.getClaimedAt()).isNotNull();
        assertThat(inquiry.getFirstResponseAt()).isNotNull();
    }

    @Test
    void consumableManagerCannotClaimAnAdminInquiry() {
        AppUser manager = AppUser.builder()
                .id(3)
                .username("supply")
                .role("ConsumableManager")
                .status("Hoạt động")
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(manager);
        when(inquiryRepository.findForUpdateById(99L)).thenReturn(Optional.of(pendingItemizedInquiry()));

        assertThatThrownBy(() -> inquiryService.claim(99L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("không thuộc nhóm xử lý");
    }

    private void stubCreate(Asset asset) {
        when(workflowSettingService.getEffectiveSettings()).thenReturn(
                new InquiryWorkflowSettingService.EffectiveSettings(
                        30, 45, 24, 20, new BigDecimal("5000000")));
        when(currentUserProvider.getCurrentUser()).thenReturn(employee);
        when(assetRepository.findDetailByQaCode(asset.getQaCode())).thenReturn(Optional.of(asset));
        when(locationRepository.findById(destination.getId())).thenReturn(Optional.of(destination));
        when(inquiryRepository.save(any(ServiceInquiry.class))).thenAnswer(invocation -> {
            ServiceInquiry inquiry = invocation.getArgument(0);
            inquiry.setId(99L);
            return inquiry;
        });
        when(messageRepository.countUnread(99L, employee.getId())).thenReturn(0L);
        when(appUserRepository.findByRole(any())).thenReturn(List.of());
    }

    private InquiryCreateRequest requestFor(Asset asset, LocalDate expectedReturnDate) {
        return InquiryCreateRequest.builder()
                .assetQaCode(asset.getQaCode())
                .destinationLocationId(destination.getId())
                .quantityRequested(1)
                .neededFrom(LocalDate.now().plusDays(1))
                .expectedReturnDate(expectedReturnDate)
                .purpose("Phục vụ công việc")
                .build();
    }

    private ServiceInquiry pendingItemizedInquiry() {
        Asset asset = Asset.builder()
                .qaCode("QA0001")
                .name("Máy chiếu")
                .trackingMode("ITEMIZED")
                .status("Sẵn sàng")
                .technicalStatus("Tốt")
                .usageStatus("Tại kho")
                .location(homeLocation)
                .homeLocation(homeLocation)
                .build();
        return ServiceInquiry.builder()
                .id(99L)
                .inquiryType("ASSET_BORROW")
                .requester(employee)
                .targetRole("Admin")
                .asset(asset)
                .quantityRequested(1)
                .destinationLocation(destination)
                .neededFrom(LocalDate.now().plusDays(1))
                .expectedReturnDate(LocalDate.now().plusDays(2))
                .purpose("Phục vụ công việc")
                .status("NEW")
                .alternativeAccepted(false)
                .build();
    }
}
