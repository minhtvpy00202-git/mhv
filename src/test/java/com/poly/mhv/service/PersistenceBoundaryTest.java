package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.notification.NotificationTarget;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Notification;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.entity.TicketEvent;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.NotificationRepository;
import com.poly.mhv.repository.TicketEventRepository;
import com.poly.mhv.repository.TicketRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PersistenceBoundaryTest {

    @Test
    void ticketEventTextIsBoundedToDatabaseColumns() {
        TicketEventRepository repository = mock(TicketEventRepository.class);
        TicketEventService service = new TicketEventService(
                repository,
                mock(TicketRepository.class),
                mock(CurrentUserProvider.class));
        Ticket ticket = Ticket.builder().id(5).build();
        AppUser actor = AppUser.builder()
                .id(3)
                .username("techsup1")
                .fullName("A".repeat(200))
                .build();
        service.recordEvent(
                ticket,
                "X".repeat(80),
                actor,
                "M".repeat(700),
                Map.of("reason", "R".repeat(5000)));

        ArgumentCaptor<TicketEvent> captor = ArgumentCaptor.forClass(TicketEvent.class);
        org.mockito.Mockito.verify(repository).save(captor.capture());
        TicketEvent saved = captor.getValue();
        assertTrue(saved.getEventType().length() <= 40);
        assertTrue(saved.getActorName().length() <= 120);
        assertTrue(saved.getMessage().length() <= 500);
        assertTrue(saved.getDetailJson().length() <= 4000);
    }

    @Test
    void notificationTextIsBoundedToDatabaseColumns() {
        NotificationRepository repository = mock(NotificationRepository.class);
        when(repository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        NotificationService service = new NotificationService(
                repository,
                mock(AppUserRepository.class),
                mock(AdminAlertSseService.class),
                mock(AsyncRealtimePushService.class),
                mock(CurrentUserProvider.class));
        service.createNotification(
                "E".repeat(80),
                "T".repeat(400),
                "M".repeat(800),
                "U".repeat(80),
                "Q".repeat(30),
                "A".repeat(300),
                Map.of("reason", "R".repeat(5000)),
                List.of(NotificationTarget.forRole("Admin", "/admin/tickets")));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        org.mockito.Mockito.verify(repository).save(captor.capture());
        Notification saved = captor.getValue();
        assertTrue(saved.getEventType().length() <= 50);
        assertTrue(saved.getTitle().length() <= 255);
        assertTrue(saved.getMessage().length() <= 500);
        assertTrue(saved.getActorUsername().length() <= 50);
        assertEquals(20, saved.getAssetQaCode().length());
        assertTrue(saved.getAssetName().length() <= 255);
        assertTrue(saved.getDetailJson().length() <= 4000);
    }
}
