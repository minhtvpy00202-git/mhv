package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.ChatMessage;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.repository.ChatMessageRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class ChatMediaAccessServiceTest {

    @Mock ChatMessageRepository chatMessageRepository;
    @Mock CurrentUserProvider currentUserProvider;
    @InjectMocks ChatMediaAccessService service;

    @Test
    void reporterCanReadChatMediaFromOwnTicket() {
        AppUser reporter = user(1, "NhanVien");
        stubMedia(reporter);
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);

        assertDoesNotThrow(() -> service.ensureCanRead("/uploads/chat/image/test.png"));
    }

    @Test
    void unrelatedAuthenticatedUserCannotReadChatMedia() {
        AppUser reporter = user(1, "NhanVien");
        stubMedia(reporter);
        when(currentUserProvider.getCurrentUser()).thenReturn(user(2, "NhanVien"));

        assertThrows(
                AccessDeniedException.class,
                () -> service.ensureCanRead("/uploads/chat/image/test.png"));
    }

    private void stubMedia(AppUser reporter) {
        Ticket ticket = Ticket.builder().id(9).reporter(reporter).build();
        ChatMessage message = ChatMessage.builder()
                .id(7)
                .ticket(ticket)
                .mediaUrl("/uploads/chat/image/test.png")
                .build();
        when(chatMessageRepository.findFirstByMediaUrl("/uploads/chat/image/test.png"))
                .thenReturn(Optional.of(message));
    }

    private AppUser user(Integer id, String role) {
        return AppUser.builder()
                .id(id)
                .username("user" + id)
                .role(role)
                .status("Hoạt động")
                .build();
    }
}
