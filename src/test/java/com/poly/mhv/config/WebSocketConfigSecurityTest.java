package com.poly.mhv.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.poly.mhv.security.jwt.JwtUtils;
import com.poly.mhv.security.services.UserDetailsImpl;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;

class WebSocketConfigSecurityTest {

    private final WebSocketConfig config = new WebSocketConfig(
            mock(JwtUtils.class),
            mock(UserDetailsService.class));

    @Test
    void userCanSubscribeToOwnPrivateTopic() {
        assertDoesNotThrow(() -> config.enforcePrivateTopicSubscription(
                subscription("/topic/users/3/notifications", 3)));
    }

    @Test
    void userCannotSubscribeToAnotherUsersTopic() {
        assertThrows(
                IllegalArgumentException.class,
                () -> config.enforcePrivateTopicSubscription(
                        subscription("/topic/users/4/notifications", 3)));
    }

    @Test
    void globalNotificationTopicIsRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () -> config.enforcePrivateTopicSubscription(
                        subscription("/topic/notifications", 3)));
    }

    private StompHeaderAccessor subscription(String destination, Integer userId) {
        UserDetailsImpl principal = UserDetailsImpl.fromJwtClaims(
                userId,
                "user" + userId,
                "User " + userId,
                "NhanVien",
                "Hoạt động",
                List.of(),
                List.of());
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()));
        return accessor;
    }
}
