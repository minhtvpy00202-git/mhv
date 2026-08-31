package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.chat.ChatMessageSendRequest;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.ChatMessage;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.ChatMessageRepository;
import com.poly.mhv.repository.TicketRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class ChatServiceWorkflowTest {

    @Mock ChatMessageRepository chatMessageRepository;
    @Mock TicketRepository ticketRepository;
    @Mock AppUserRepository appUserRepository;
    @Mock CurrentUserProvider currentUserProvider;
    @Mock ChatMediaStorageService chatMediaStorageService;
    @Mock TicketEventService ticketEventService;

    @InjectMocks ChatService chatService;

    @Test
    void assignedTechnicianCanSendMessageWhileTicketIsOpen() {
        AppUser reporter = user(1, "nhanvien", "NhanVien");
        AppUser technician = user(2, "techsup1", "TechSupport");
        Ticket ticket = ticket(10, "IN_PROGRESS", reporter, technician);
        when(ticketRepository.findById(10)).thenReturn(Optional.of(ticket));
        when(appUserRepository.findByUsername("techsup1")).thenReturn(Optional.of(technician));
        when(chatMediaStorageService.processIncomingContent("Đang kiểm tra nguồn thiết bị."))
                .thenReturn(new ChatMediaStorageService.ProcessedChatPayload(
                        "Đang kiểm tra nguồn thiết bị.", null, null));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage saved = invocation.getArgument(0);
            saved.setId(100);
            return saved;
        });

        var response = chatService.saveTicketMessage(
                10,
                ChatMessageSendRequest.builder()
                        .ticketId(10)
                        .content("Đang kiểm tra nguồn thiết bị.")
                        .build(),
                "techsup1");

        assertEquals(100, response.getId());
        assertEquals(10, response.getTicketId());
        assertEquals("Đang kiểm tra nguồn thiết bị.", response.getContent());
    }

    @Test
    void unrelatedEmployeeCannotReadTicketChat() {
        AppUser reporter = user(1, "nhanvien", "NhanVien");
        AppUser unrelated = user(3, "nhanvien2", "NhanVien");
        Ticket ticket = ticket(11, "IN_PROGRESS", reporter, null);
        when(ticketRepository.findById(11)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(unrelated);

        assertThrows(AccessDeniedException.class, () -> chatService.getTicketChats(11, 50));
    }

    @Test
    void reporterCannotSendMessageAfterTicketIsClosed() {
        AppUser reporter = user(1, "nhanvien", "NhanVien");
        Ticket ticket = ticket(12, "RESOLVED", reporter, null);
        when(ticketRepository.findById(12)).thenReturn(Optional.of(ticket));
        when(appUserRepository.findByUsername("nhanvien")).thenReturn(Optional.of(reporter));

        CustomException error = assertThrows(CustomException.class, () -> chatService.saveTicketMessage(
                12,
                ChatMessageSendRequest.builder().ticketId(12).content("Tin nhắn sau đóng.").build(),
                "nhanvien"));

        assertEquals("Ticket đã đóng. Bạn chỉ có thể xem lại lịch sử trao đổi.", error.getMessage());
    }

    @Test
    void reporterCanReadChatHistoryAfterTicketIsClosed() {
        AppUser reporter = user(1, "nhanvien", "NhanVien");
        Ticket ticket = ticket(13, "RESOLVED", reporter, null);
        when(ticketRepository.findById(13)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);
        when(chatMessageRepository.findByTicketIdOrderByCreatedAtDesc(13, org.springframework.data.domain.PageRequest.of(0, 50)))
                .thenReturn(List.of());

        assertEquals(List.of(), chatService.getTicketChats(13, 50));
    }

    @Test
    void adminCanReadTicketChatButIsNotAChatParticipant() {
        AppUser reporter = user(1, "nhanvien", "NhanVien");
        AppUser administrator = user(9, "admin", "Admin");
        Ticket ticket = ticket(14, "IN_PROGRESS", reporter, null);
        when(ticketRepository.findById(14)).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(administrator);
        when(chatMessageRepository.findByTicketIdOrderByCreatedAtDesc(14, org.springframework.data.domain.PageRequest.of(0, 20)))
                .thenReturn(List.of());

        assertEquals(List.of(), chatService.getTicketChats(14, 20));
    }

    private Ticket ticket(Integer id, String status, AppUser reporter, AppUser assignee) {
        return Ticket.builder()
                .id(id)
                .status(status)
                .reporter(reporter)
                .assignee(assignee)
                .build();
    }

    private AppUser user(Integer id, String username, String role) {
        return AppUser.builder()
                .id(id)
                .username(username)
                .role(role)
                .status("Hoạt động")
                .build();
    }
}
