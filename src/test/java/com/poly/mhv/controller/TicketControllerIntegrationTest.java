package com.poly.mhv.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketResolutionRequest;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.security.jwt.AuthTokenFilter;
import com.poly.mhv.service.TicketEventService;
import com.poly.mhv.service.TicketService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = TicketController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = AuthTokenFilter.class))
@Import(TicketControllerIntegrationTest.MethodSecurityConfiguration.class)
class TicketControllerIntegrationTest {

    @Autowired MockMvc mockMvc;

    @MockitoBean TicketService ticketService;
    @MockitoBean TicketEventService ticketEventService;

    @TestConfiguration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class MethodSecurityConfiguration {
    }

    @Test
    @WithMockUser(username = "nhanvien", roles = "NhanVien")
    void employeeCanCreateTicketThroughJsonApi() throws Exception {
        when(ticketService.createTicket(any(TicketCreateRequest.class)))
                .thenReturn(TicketResponse.builder()
                        .id(101)
                        .assetQaCode("QA-100")
                        .status("PENDING")
                        .build());

        mockMvc.perform(post("/api/tickets")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assetQaCode": "QA-100",
                                  "description": "Thiết bị không thể khởi động bình thường.",
                                  "priority": "HIGH"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.assetQaCode").value("QA-100"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    @WithMockUser(username = "techsup1", roles = "TechSupport")
    void technicianCannotCreateTicketForEmployee() throws Exception {
        mockMvc.perform(post("/api/tickets")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assetQaCode": "QA-100",
                                  "description": "Thiết bị không thể khởi động bình thường.",
                                  "priority": "HIGH"
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "techsup1", roles = "TechSupport")
    void technicianCanSubmitValidRepairResult() throws Exception {
        when(ticketService.resolveTicket(eq(17), any(TicketResolutionRequest.class)))
                .thenReturn(TicketResponse.builder()
                        .id(17)
                        .status("AWAITING_CONFIRMATION")
                        .resolutionOutcome("REPAIRED")
                        .build());

        mockMvc.perform(put("/api/tickets/17/resolve")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "outcome": "REPAIRED",
                                  "note": "Đã thay thế linh kiện và kiểm tra hoạt động ổn định."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AWAITING_CONFIRMATION"))
                .andExpect(jsonPath("$.resolutionOutcome").value("REPAIRED"));
    }

    @Test
    @WithMockUser(username = "nhanvien", roles = "NhanVien")
    void employeeCannotSubmitTechnicalRepairResult() throws Exception {
        mockMvc.perform(put("/api/tickets/17/resolve")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "outcome": "REPAIRED",
                                  "note": "Đã thay thế linh kiện và kiểm tra hoạt động ổn định."
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "techsup1", roles = "TechSupport")
    void invalidResolutionOutcomeIsRejectedBeforeServiceCall() throws Exception {
        mockMvc.perform(put("/api/tickets/17/resolve")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "outcome": "DONE",
                                  "note": "Đã thay thế linh kiện và kiểm tra hoạt động ổn định."
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Kết quả xử lý không hợp lệ."));

        verify(ticketService, never()).resolveTicket(eq(17), any(TicketResolutionRequest.class));
    }

    @Test
    @WithMockUser(username = "nhanvien", roles = "NhanVien")
    void reporterCanConfirmSubmittedResolution() throws Exception {
        when(ticketService.confirmResolution(17))
                .thenReturn(TicketResponse.builder().id(17).status("RESOLVED").build());

        mockMvc.perform(put("/api/tickets/17/confirm-resolution").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));
    }

    @Test
    @WithMockUser(username = "techsup1", roles = "TechSupport")
    void technicianCannotConfirmResolutionOnBehalfOfReporter() throws Exception {
        mockMvc.perform(put("/api/tickets/17/confirm-resolution").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "nhanvien", roles = "NhanVien")
    void shortRejectReasonIsRejectedByApiValidation() throws Exception {
        mockMvc.perform(put("/api/tickets/17/reject-resolution")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"còn lỗi\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Lý do phải từ 10 đến 1000 ký tự."));
    }

    @Test
    @WithMockUser(username = "nhanvien", roles = "NhanVien")
    void employeeCannotOpenAdminTicketListing() throws Exception {
        mockMvc.perform(get("/api/tickets/admin"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anonymousUserCannotReadTicketListing() throws Exception {
        mockMvc.perform(get("/api/tickets"))
                .andExpect(status().isUnauthorized());
    }
}
