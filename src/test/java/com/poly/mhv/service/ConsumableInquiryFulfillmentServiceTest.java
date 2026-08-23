package com.poly.mhv.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.asset.ConsumableRequestResponse;
import com.poly.mhv.dto.inquiry.ConsumableFulfillmentQuantityRequest;
import com.poly.mhv.dto.inquiry.ConsumableInquiryFulfillmentResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ConsumableInquiryFulfillment;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AreaTypeCatalogRepository;
import com.poly.mhv.repository.ConsumableInquiryFulfillmentRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.ServiceInquiryRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConsumableInquiryFulfillmentServiceTest {

    @Mock private ConsumableInquiryFulfillmentRepository fulfillmentRepository;
    @Mock private ServiceInquiryRepository inquiryRepository;
    @Mock private ConsumableRequestRepository consumableRequestRepository;
    @Mock private LocationRepository locationRepository;
    @Mock private AreaTypeCatalogRepository areaTypeCatalogRepository;
    @Mock private AppUserRepository appUserRepository;
    @Mock private CurrentUserProvider currentUserProvider;
    @Mock private AssetService assetService;
    @Mock private NotificationService notificationService;
    @Mock private AsyncRealtimePushService realtimePushService;

    @InjectMocks private ConsumableInquiryFulfillmentService service;

    private AppUser employee;
    private AppUser manager;
    private AppUser admin;
    private ServiceInquiry inquiry;
    private ConsumableInquiryFulfillment fulfillment;

    @BeforeEach
    void setUp() {
        employee = AppUser.builder().id(1).username("employee").fullName("Nhân viên").role("NhanVien").build();
        manager = AppUser.builder().id(2).username("manager").fullName("Quản lý vật tư").role("ConsumableManager").build();
        admin = AppUser.builder().id(3).username("admin").fullName("Admin").role("Admin").build();
        Location warehouse = Location.builder().id(10).roomName("Kho A").areaTypeKey("WAREHOUSE").build();
        Location destination = Location.builder().id(20).roomName("Phòng 202").build();
        Asset asset = Asset.builder().qaCode("VT001").name("Giấy A4").trackingMode("CONSUMABLE").build();
        inquiry = ServiceInquiry.builder()
                .id(100L)
                .inquiryType("CONSUMABLE_REQUEST")
                .requester(employee)
                .targetRole("ConsumableManager")
                .assignee(manager)
                .asset(asset)
                .destinationLocation(destination)
                .status("CONVERTED")
                .updatedAt(LocalDateTime.now())
                .build();
        fulfillment = ConsumableInquiryFulfillment.builder()
                .id(200L)
                .inquiry(inquiry)
                .originalConsumableRequestId(300L)
                .activeConsumableRequestId(300L)
                .sourceWarehouseLocation(warehouse)
                .requestedQuantity(5)
                .fulfilledQuantity(0)
                .status("PENDING")
                .requiresAdminApproval(false)
                .adminApproved(true)
                .closedPartial(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void highThresholdRequestMustBeApprovedBeforePreparation() {
        fulfillment.setRequiresAdminApproval(true);
        fulfillment.setAdminApproved(false);
        when(currentUserProvider.getCurrentUser()).thenReturn(manager);
        when(fulfillmentRepository.findForUpdateById(200L)).thenReturn(Optional.of(fulfillment));

        assertThatThrownBy(() -> service.prepare(200L,
                ConsumableFulfillmentQuantityRequest.builder().quantity(2).build()))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("chờ Admin");
    }

    @Test
    void adminApprovalReleasesRequestToConsumableManager() {
        fulfillment.setRequiresAdminApproval(true);
        fulfillment.setAdminApproved(false);
        inquiry.setStatus("WAITING_APPROVAL");
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(fulfillmentRepository.findForUpdateById(200L)).thenReturn(Optional.of(fulfillment));
        when(fulfillmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ConsumableInquiryFulfillmentResponse response = service.adminApprove(200L, null);

        assertThat(response.getAdminApproved()).isTrue();
        assertThat(inquiry.getStatus()).isEqualTo("CONVERTED");
        assertThat(fulfillment.getAdminApprovedBy()).isSameAs(admin);
        verify(inquiryRepository).save(inquiry);
    }

    @Test
    void partialFulfillmentCreatesPendingRequestForRemainingQuantity() {
        fulfillment.setStatus("READY_FOR_PICKUP");
        fulfillment.setPreparedQuantity(3);
        when(currentUserProvider.getCurrentUser()).thenReturn(manager);
        when(fulfillmentRepository.findForUpdateById(200L)).thenReturn(Optional.of(fulfillment));
        when(fulfillmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(assetService.createConsumableRequestForRequester(any(), any(), any()))
                .thenReturn(ConsumableRequestResponse.builder().id(301L).build());

        ConsumableInquiryFulfillmentResponse response = service.fulfill(200L, null);

        assertThat(response.getStatus()).isEqualTo("PARTIALLY_FULFILLED");
        assertThat(response.getFulfilledQuantity()).isEqualTo(3);
        assertThat(response.getRemainingQuantity()).isEqualTo(2);
        assertThat(response.getActiveConsumableRequestId()).isEqualTo(301L);
        assertThat(inquiry.getStatus()).isEqualTo("CONVERTED");
        verify(assetService).fulfillConsumableRequest(any(), any(), any());
    }
}
