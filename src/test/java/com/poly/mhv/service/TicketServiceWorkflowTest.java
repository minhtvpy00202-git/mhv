package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import com.poly.mhv.dto.ticket.TicketAssignRequest;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketExtensionReviewRequest;
import com.poly.mhv.dto.ticket.TicketReasonRequest;
import com.poly.mhv.dto.ticket.TicketResolutionRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.TechSupportType;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.util.TicketStatusSupport;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import jakarta.persistence.Column;
import org.springframework.security.access.AccessDeniedException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TicketServiceWorkflowTest {

    @Mock TicketRepository ticketRepository;
    @Mock TicketEventRepository ticketEventRepository;
    @Mock AssetRepository assetRepository;
    @Mock AppUserRepository appUserRepository;
    @Mock AsyncRealtimePushService asyncRealtimePushService;
    @Mock NotificationService notificationService;
    @Mock CurrentUserProvider currentUserProvider;
    @Mock TicketEventService ticketEventService;
    @Mock TicketImageStorageService ticketImageStorageService;
    @Mock AssetService assetService;
    @Mock DashboardService dashboardService;
    @Mock HelpdeskKpiService helpdeskKpiService;

    @InjectMocks TicketService ticketService;

    @Test
    void ticketStatusColumnCanPersistEveryWorkflowStatus() throws NoSuchFieldException {
        Column statusColumn = Ticket.class.getDeclaredField("status").getAnnotation(Column.class);
        int longestStatusLength = TicketStatusSupport.FILTERABLE_STATUSES.stream()
                .mapToInt(String::length)
                .max()
                .orElseThrow();

        assertTrue(
                statusColumn.length() >= longestStatusLength,
                "tickets.status is too short for the configured workflow states");
    }

    @Test
    void createTicketRejectsSecondActiveTicketForSameAsset() {
        Asset asset = itemizedAsset("QA-001");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        when(assetRepository.findByQaCodeForUpdate("QA-001")).thenReturn(Optional.of(asset));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);
        when(ticketRepository.existsByAssetQaCodeAndStatusIn(eq("QA-001"), anyCollection()))
                .thenReturn(true);

        CustomException error = assertThrows(CustomException.class, () -> ticketService.createTicket(
                TicketCreateRequest.builder()
                        .assetQaCode("QA-001")
                        .description("Thiết bị không thể khởi động bình thường.")
                        .priority("HIGH")
                        .build()));

        assertEquals("Tài sản này đã có ticket đang chờ hoặc đang được xử lý.", error.getMessage());
    }

    @Test
    void createTicketRejectsClientSlaOutsideServerPolicy() {
        Asset asset = itemizedAsset("QA-002");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        when(assetRepository.findByQaCodeForUpdate("QA-002")).thenReturn(Optional.of(asset));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);
        when(ticketRepository.existsByAssetQaCodeAndStatusIn(eq("QA-002"), anyCollection()))
                .thenReturn(false);

        CustomException error = assertThrows(CustomException.class, () -> ticketService.createTicket(
                TicketCreateRequest.builder()
                        .assetQaCode("QA-002")
                        .description("Thiết bị mất nguồn đột ngột nhiều lần.")
                        .priority("HIGH")
                        .minSlaMinutes(5)
                        .maxSlaMinutes(120)
                        .build()));

        assertEquals("Khoảng SLA không hợp lệ với mức ưu tiên HIGH.", error.getMessage());
    }

    @Test
    void reassignRejectsLockedTechnician() {
        Asset asset = itemizedAsset("QA-003");
        Ticket ticket = Ticket.builder().id(3).asset(asset).status("IN_PROGRESS").build();
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        AppUser lockedTech = user(20, "techsup1", "TechSupport", "Khóa");
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(ticketRepository.findDetailForUpdateById(3)).thenReturn(Optional.of(ticket));
        when(appUserRepository.findById(20)).thenReturn(Optional.of(lockedTech));

        CustomException error = assertThrows(CustomException.class, () -> ticketService.reassignTicket(
                3,
                TicketAssignRequest.builder().assigneeId(20).build()));

        assertEquals("Không thể phân công ticket cho tài khoản kỹ thuật viên đang bị khóa.", error.getMessage());
    }

    @Test
    void extensionCannotBeApprovedAfterTicketIsClosed() {
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        Ticket ticket = Ticket.builder().id(4).status("RESOLVED").build();
        when(ticketRepository.findDetailForUpdateById(4)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);

        CustomException error = assertThrows(CustomException.class, () -> ticketService.reviewExtension(
                4,
                TicketExtensionReviewRequest.builder().decision("APPROVED").build()));

        assertEquals("Không thể duyệt gia hạn vì ticket không còn ở bước xử lý kỹ thuật.", error.getMessage());
    }

    @Test
    void replacementRequiredDoesNotCloseTicketAsSuccessfullyResolved() {
        Asset asset = detailedAsset("QA-018");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(18)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("MEDIUM")
                .status("IN_PROGRESS")
                .createdAt(LocalDateTime.now().minusHours(1))
                .dueDate(LocalDateTime.now().plusHours(5))
                .build();
        when(ticketRepository.findDetailForUpdateById(18)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(technician);
        when(assetRepository.findByQaCodeForUpdate("QA-018")).thenReturn(Optional.of(asset));
        when(ticketRepository.findByAssetQaCodeAndStatusIn(eq("QA-018"), anyCollection())).thenReturn(List.of());
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.resolveTicket(
                18,
                TicketResolutionRequest.builder()
                        .outcome("REPLACEMENT_REQUIRED")
                        .note("Thiết bị hỏng bo mạch và cần được thay thế.")
                        .build());

        assertEquals("WAITING_REPLACEMENT", response.getStatus());
        assertEquals("REPLACEMENT_REQUIRED", response.getResolutionOutcome());
        assertNull(response.getResolvedAt());
        assertEquals("Hỏng", response.getAssetTechnicalStatus());
    }

    @Test
    void repairedOutcomeWaitsForReporterConfirmation() {
        Asset asset = detailedAsset("QA-025");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(25)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("MEDIUM")
                .status("IN_PROGRESS")
                .createdAt(LocalDateTime.now().minusHours(1))
                .dueDate(LocalDateTime.now().plusHours(5))
                .build();
        when(ticketRepository.findDetailForUpdateById(25)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(technician);
        when(assetRepository.findByQaCodeForUpdate("QA-025")).thenReturn(Optional.of(asset));
        when(ticketRepository.findByAssetQaCodeAndStatusIn(eq("QA-025"), anyCollection())).thenReturn(List.of());
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.resolveTicket(
                25,
                TicketResolutionRequest.builder()
                        .outcome("REPAIRED")
                        .note("Đã thay linh kiện và kiểm tra thiết bị hoạt động ổn định.")
                        .build());

        assertEquals("AWAITING_CONFIRMATION", response.getStatus());
        assertNotNull(response.getResolvedAt());
        assertNotNull(response.getConfirmationDueAt());
        assertNull(response.getClosedAt());
        assertEquals("Hoạt động tốt", response.getAssetTechnicalStatus());
    }

    @Test
    void waitingReplacementCanReturnToConfirmationAfterReplacement() {
        Asset asset = detailedAsset("QA-026");
        asset.setTechnicalStatus("Hỏng");
        asset.setStatus("Hỏng");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(26)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("MEDIUM")
                .status("WAITING_REPLACEMENT")
                .resolutionOutcome("REPLACEMENT_REQUIRED")
                .resolutionNote("Thiết bị cần thay thế linh kiện nguồn.")
                .createdAt(LocalDateTime.now().minusHours(2))
                .dueDate(LocalDateTime.now().plusHours(4))
                .build();
        when(ticketRepository.findDetailForUpdateById(26)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(technician);
        when(assetRepository.findByQaCodeForUpdate("QA-026")).thenReturn(Optional.of(asset));
        when(ticketRepository.findByAssetQaCodeAndStatusIn(eq("QA-026"), anyCollection())).thenReturn(List.of());
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.resolveTicket(
                26,
                TicketResolutionRequest.builder()
                        .outcome("REPAIRED")
                        .note("Đã thay thế linh kiện nguồn và chạy thử thành công.")
                        .build());

        assertEquals("AWAITING_CONFIRMATION", response.getStatus());
        assertEquals("REPAIRED", response.getResolutionOutcome());
        assertNotNull(response.getConfirmationDueAt());
        assertEquals("Hoạt động tốt", response.getAssetTechnicalStatus());
    }

    @Test
    void unrepairableOutcomeClosesTicketWithoutMarkingAssetGood() {
        Asset asset = detailedAsset("QA-027");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(27)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("HIGH")
                .status("IN_PROGRESS")
                .createdAt(LocalDateTime.now().minusHours(1))
                .dueDate(LocalDateTime.now().plusHours(1))
                .build();
        when(ticketRepository.findDetailForUpdateById(27)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(technician);
        when(assetRepository.findByQaCodeForUpdate("QA-027")).thenReturn(Optional.of(asset));
        when(ticketRepository.findByAssetQaCodeAndStatusIn(eq("QA-027"), anyCollection())).thenReturn(List.of());
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.resolveTicket(
                27,
                TicketResolutionRequest.builder()
                        .outcome("UNREPAIRABLE")
                        .note("Bo mạch cháy hoàn toàn và không còn linh kiện thay thế phù hợp.")
                        .build());

        assertEquals("CLOSED_UNRESOLVED", response.getStatus());
        assertNotNull(response.getClosedAt());
        assertNull(response.getResolvedAt());
        assertEquals("Hỏng", response.getAssetTechnicalStatus());
    }

    @Test
    void technicianCannotResolveTicketAssignedToAnotherTechnician() {
        Asset asset = detailedAsset("QA-028");
        AppUser assigned = user(3, "techsup1", "TechSupport", "Hoạt động");
        AppUser otherTechnician = user(4, "techsup2", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(28)
                .asset(asset)
                .assignee(assigned)
                .status("IN_PROGRESS")
                .build();
        when(ticketRepository.findDetailForUpdateById(28)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(otherTechnician);

        assertThrows(AccessDeniedException.class, () -> ticketService.resolveTicket(
                28,
                TicketResolutionRequest.builder()
                        .outcome("REPAIRED")
                        .note("Đã sửa chữa và kiểm tra lại thiết bị thành công.")
                        .build()));
    }

    @Test
    void reporterCannotCancelTicketAfterTechnicianAcceptedIt() {
        Asset asset = detailedAsset("QA-029");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(29)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .status("IN_PROGRESS")
                .build();
        when(ticketRepository.findDetailForUpdateById(29)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);

        CustomException error = assertThrows(CustomException.class, () -> ticketService.cancelTicket(
                29,
                TicketReasonRequest.builder()
                        .reason("Không còn nhu cầu tiếp tục xử lý ticket này nữa.")
                        .build()));

        assertEquals("Người báo chỉ được hủy ticket khi chưa có kỹ thuật viên tiếp nhận.", error.getMessage());
    }

    @Test
    void matchingTechnicianCannotReadTicketAssignedToSomeoneElse() {
        TechSupportType specialty = TechSupportType.builder().id(9).name("Điện tử").build();
        Asset asset = detailedAsset("QA-019");
        asset.getCategory().setTechSupportType(specialty);
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser assigned = user(6, "techsup4", "TechSupport", "Hoạt động");
        AppUser otherTech = user(3, "techsup1", "TechSupport", "Hoạt động");
        otherTech.setTechSupportTypes(List.of(specialty));
        Ticket ticket = Ticket.builder()
                .id(19)
                .asset(asset)
                .reporter(reporter)
                .assignee(assigned)
                .status("IN_PROGRESS")
                .build();
        when(ticketRepository.findDetailById(19)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(otherTech);

        assertThrows(AccessDeniedException.class, () -> ticketService.getTicketById(19));
    }

    @Test
    void adminCannotRateOnBehalfOfReporter() {
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        Ticket ticket = Ticket.builder().id(20).reporter(reporter).status("RESOLVED").build();
        when(ticketRepository.findDetailForUpdateById(20)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);

        assertThrows(AccessDeniedException.class, () -> ticketService.rateSatisfaction(
                20,
                com.poly.mhv.dto.ticket.TicketSatisfactionRequest.builder()
                        .satisfactionScore(5)
                        .build()));
    }

    @Test
    void reporterCannotReopenTicketAfterSevenDayWindow() {
        Asset asset = detailedAsset("QA-021");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(21)
                .asset(asset)
                .reporter(reporter)
                .status("RESOLVED")
                .closedAt(LocalDateTime.now().minusDays(8))
                .build();
        when(ticketRepository.findDetailForUpdateById(21)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);

        CustomException error = assertThrows(CustomException.class, () -> ticketService.reopenTicket(
                21,
                TicketReasonRequest.builder().reason("Thiết bị tiếp tục phát sinh lỗi sau sửa chữa.").build()));

        assertEquals("Đã hết thời hạn 7 ngày để mở lại ticket. Vui lòng tạo báo hỏng mới.", error.getMessage());
    }

    @Test
    void reporterConfirmationIsRequiredBeforeTicketBecomesResolved() {
        Asset asset = detailedAsset("QA-022");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(22)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("MEDIUM")
                .status("AWAITING_CONFIRMATION")
                .resolvedAt(LocalDateTime.now().minusMinutes(5))
                .confirmationDueAt(LocalDateTime.now().plusHours(72))
                .resolutionOutcome("REPAIRED")
                .resolutionNote("Thiết bị đã hoạt động ổn định sau sửa chữa.")
                .build();
        when(ticketRepository.findDetailForUpdateById(22)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.confirmResolution(22);

        assertEquals("RESOLVED", response.getStatus());
        assertNotNull(response.getConfirmedAt());
        assertNotNull(response.getClosedAt());
        assertNull(response.getConfirmationDueAt());
    }

    @Test
    void reporterCanReturnUnsuccessfulResultToAssignedTechnician() {
        Asset asset = detailedAsset("QA-023");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(23)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("HIGH")
                .status("AWAITING_CONFIRMATION")
                .resolvedAt(LocalDateTime.now().minusMinutes(5))
                .confirmationDueAt(LocalDateTime.now().plusHours(72))
                .resolutionOutcome("REPAIRED")
                .resolutionNote("Kỹ thuật viên đã thử khởi động lại thiết bị.")
                .build();
        when(ticketRepository.findDetailForUpdateById(23)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);
        when(assetRepository.findByQaCodeForUpdate("QA-023")).thenReturn(Optional.of(asset));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.rejectResolution(
                23,
                TicketReasonRequest.builder()
                        .reason("Thiết bị vẫn mất nguồn sau khi sử dụng khoảng mười phút.")
                        .build());

        assertEquals("IN_PROGRESS", response.getStatus());
        assertNull(response.getResolutionOutcome());
        assertNull(response.getConfirmationDueAt());
        assertEquals("Hỏng", response.getAssetTechnicalStatus());
    }

    @Test
    void confirmationSchedulerAutoClosesExpiredTicketWithoutUserRating() {
        Asset asset = detailedAsset("QA-024");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(24)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .status("AWAITING_CONFIRMATION")
                .confirmationDueAt(LocalDateTime.now().minusDays(1))
                .resolutionOutcome("REPAIRED")
                .resolutionNote("Thiết bị đã được sửa chữa và kiểm tra tải.")
                .build();
        when(ticketRepository.findByStatusAndConfirmationDueAtLessThanEqual(eq("AWAITING_CONFIRMATION"), any(LocalDateTime.class)))
                .thenReturn(List.of(ticket));
        when(ticketRepository.findDetailForUpdateById(24)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int closed = ticketService.autoCloseExpiredConfirmations();

        assertEquals(1, closed);
        assertEquals("RESOLVED", ticket.getStatus());
        assertNull(ticket.getConfirmedAt());
        assertTrue(ticket.getClosedReason().contains("tự động đóng"));
    }

    @Test
    void adminCancellationDuringRepairKeepsAssetBroken() {
        Asset asset = detailedAsset("QA-030");
        asset.setTechnicalStatus("Hỏng");
        asset.setStatus("Bảo trì");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(30)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("HIGH")
                .status("IN_PROGRESS")
                .assetTechnicalStatusBeforeReport("Hoạt động tốt")
                .assetStatusBeforeReport("Sẵn sàng")
                .createdAt(LocalDateTime.now().minusHours(1))
                .dueDate(LocalDateTime.now().plusHours(1))
                .build();
        when(ticketRepository.findDetailForUpdateById(30)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(assetRepository.findByQaCodeForUpdate("QA-030")).thenReturn(Optional.of(asset));
        when(ticketRepository.findByAssetQaCodeAndStatusIn(eq("QA-030"), anyCollection())).thenReturn(List.of());
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.cancelTicket(
                30,
                TicketReasonRequest.builder()
                        .reason("Dừng xử lý để chuyển sang quy trình thanh lý thiết bị.")
                        .build());

        assertEquals("CANCELLED", response.getStatus());
        assertEquals("Hỏng", response.getAssetTechnicalStatus());
        assertEquals("Hỏng", asset.getStatus());
    }

    @Test
    void reassignmentExpiresOldExtensionAndStartsKpiForNewTechnician() {
        Asset asset = detailedAsset("QA-031");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser oldTechnician = user(3, "techsup1", "TechSupport", "Hoạt động");
        AppUser newTechnician = user(4, "techsup2", "TechSupport", "Hoạt động");
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        LocalDateTime oldAcceptedAt = com.poly.mhv.util.UtcDateTimes.now().minusHours(2);
        Ticket ticket = Ticket.builder()
                .id(31)
                .asset(asset)
                .reporter(reporter)
                .assignee(oldTechnician)
                .priority("MEDIUM")
                .status("IN_PROGRESS")
                .acceptedAt(oldAcceptedAt)
                .createdAt(com.poly.mhv.util.UtcDateTimes.now().minusHours(3))
                .dueDate(com.poly.mhv.util.UtcDateTimes.now().plusHours(3))
                .build();
        com.poly.mhv.entity.TicketEvent pendingExtension = com.poly.mhv.entity.TicketEvent.builder()
                .id(80)
                .ticket(ticket)
                .eventType("EXTENSION_REQUESTED")
                .message("Xin thêm 60 phút")
                .detailJson("requestedMinutes: 60")
                .occurredAt(com.poly.mhv.util.UtcDateTimes.now().minusMinutes(10))
                .build();
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(ticketRepository.findDetailForUpdateById(31)).thenReturn(Optional.of(ticket));
        when(appUserRepository.findById(4)).thenReturn(Optional.of(newTechnician));
        when(ticketEventRepository.findFirstByTicketIdAndEventTypeInOrderByOccurredAtDescIdDesc(
                eq(31), anyCollection())).thenReturn(Optional.of(pendingExtension));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ticketService.reassignTicket(
                31,
                TicketAssignRequest.builder().assigneeId(4).build());

        assertEquals(4, response.getAssigneeId());
        assertTrue(ticket.getAcceptedAt().isAfter(oldAcceptedAt));
        verify(ticketEventService).recordEvent(
                eq(ticket),
                eq("EXTENSION_EXPIRED"),
                eq(admin),
                any(String.class),
                any(java.util.Map.class));
    }

    @Test
    void overdueTicketCannotReceiveRetroactiveSlaExtension() {
        Asset asset = detailedAsset("QA-032");
        AppUser reporter = user(1, "nhanvien", "NhanVien", "Hoạt động");
        AppUser technician = user(3, "techsup1", "TechSupport", "Hoạt động");
        AppUser admin = user(10, "admin", "Admin", "Hoạt động");
        Ticket ticket = Ticket.builder()
                .id(32)
                .asset(asset)
                .reporter(reporter)
                .assignee(technician)
                .priority("HIGH")
                .status("IN_PROGRESS")
                .createdAt(com.poly.mhv.util.UtcDateTimes.now().minusHours(3))
                .dueDate(com.poly.mhv.util.UtcDateTimes.now().minusMinutes(1))
                .slaMinMinutes(30)
                .slaMaxMinutes(120)
                .build();
        com.poly.mhv.entity.TicketEvent pendingExtension = com.poly.mhv.entity.TicketEvent.builder()
                .id(81)
                .ticket(ticket)
                .eventType("EXTENSION_REQUESTED")
                .message("Xin thêm 60 phút")
                .detailJson("requestedMinutes: 60")
                .occurredAt(com.poly.mhv.util.UtcDateTimes.now().minusMinutes(10))
                .build();
        when(ticketRepository.findDetailForUpdateById(32)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(admin);
        when(ticketEventRepository.findFirstByTicketIdAndEventTypeInOrderByOccurredAtDescIdDesc(
                eq(32), anyCollection())).thenReturn(Optional.of(pendingExtension));
        when(ticketEventRepository.findByTicketIdAndEventTypeOrderByOccurredAtAscIdAsc(32, "EXTENSION_APPROVED"))
                .thenReturn(List.of());

        CustomException error = assertThrows(CustomException.class, () -> ticketService.reviewExtension(
                32,
                TicketExtensionReviewRequest.builder().decision("APPROVED").build()));

        assertEquals("Không thể duyệt gia hạn sau khi ticket đã quá hạn SLA.", error.getMessage());
        assertEquals(120, ticket.getSlaMaxMinutes());
    }

    private Asset itemizedAsset(String qaCode) {
        return Asset.builder()
                .qaCode(qaCode)
                .name("Thiết bị kiểm thử")
                .trackingMode("ITEMIZED")
                .technicalStatus("Tốt")
                .usageStatus("Tại vị trí gốc")
                .status("Tốt")
                .build();
    }

    private Asset detailedAsset(String qaCode) {
        Location location = Location.builder().id(1).roomName("Phòng kiểm thử").build();
        Category category = Category.builder().id(1).name("Thiết bị kiểm thử").codePrefix("QA").build();
        return Asset.builder()
                .qaCode(qaCode)
                .name("Thiết bị kiểm thử")
                .trackingMode("ITEMIZED")
                .technicalStatus("Tốt")
                .usageStatus("Tại vị trí gốc")
                .status("Tốt")
                .location(location)
                .homeLocation(location)
                .category(category)
                .build();
    }

    private AppUser user(Integer id, String username, String role, String status) {
        return AppUser.builder()
                .id(id)
                .username(username)
                .role(role)
                .status(status)
                .build();
    }
}
