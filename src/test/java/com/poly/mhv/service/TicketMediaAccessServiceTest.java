package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.repository.TicketRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class TicketMediaAccessServiceTest {

    @Mock TicketRepository ticketRepository;
    @Mock CurrentUserProvider currentUserProvider;

    @InjectMocks TicketMediaAccessService ticketMediaAccessService;

    @Test
    void reporterCanReadOwnTicketImage() {
        AppUser reporter = user(1, "NhanVien");
        Ticket ticket = Ticket.builder().id(1).reporter(reporter).imageUrl("/uploads/tickets/error.jpg").build();
        when(ticketRepository.findFirstByImageUrlOrResolutionImageUrl(
                "/uploads/tickets/error.jpg",
                "/uploads/tickets/error.jpg")).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(reporter);

        assertDoesNotThrow(() -> ticketMediaAccessService.ensureCanRead("/uploads/tickets/error.jpg"));
    }

    @Test
    void unrelatedEmployeeCannotReadTicketImage() {
        AppUser reporter = user(1, "NhanVien");
        AppUser unrelated = user(2, "NhanVien");
        Ticket ticket = Ticket.builder().id(1).reporter(reporter).imageUrl("/uploads/tickets/error.jpg").build();
        when(ticketRepository.findFirstByImageUrlOrResolutionImageUrl(
                "/uploads/tickets/error.jpg",
                "/uploads/tickets/error.jpg")).thenReturn(Optional.of(ticket));
        when(currentUserProvider.getCurrentUser()).thenReturn(unrelated);

        assertThrows(
                AccessDeniedException.class,
                () -> ticketMediaAccessService.ensureCanRead("/uploads/tickets/error.jpg"));
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
