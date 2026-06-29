package com.poly.mhv.config;

import com.poly.mhv.security.jwt.JwtUtils;
import com.poly.mhv.security.services.UserDetailsImpl;
import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Pattern USER_TOPIC_PATTERN = Pattern.compile("^/topic/users/(\\d+)(?:/.*)?$");

    private final JwtUtils jwtUtils;
    private final UserDetailsService userDetailsService;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
        registry.addEndpoint("/api/ws")
                .setAllowedOriginPatterns("*");
        registry.addEndpoint("/ws-sockjs")
                .setAllowedOriginPatterns("*")
                .withSockJS();
        registry.addEndpoint("/api/ws-sockjs")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null) {
                    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                        String token = extractToken(accessor);
                        if (token == null || token.isBlank()) {
                            throw new IllegalArgumentException("Thiếu JWT token trong CONNECT headers.");
                        }

                        String username = jwtUtils.getUserNameFromJwtToken(token);
                        UserDetails userDetails = buildUserDetailsFromToken(token, username);
                        if (!jwtUtils.validateJwtToken(token)) {
                            throw new IllegalArgumentException("JWT token không hợp lệ.");
                        }

                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                        accessor.setUser(authentication);
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                        enforcePrivateTopicSubscription(accessor);
                    }
                }
                return message;
            }

            private void enforcePrivateTopicSubscription(StompHeaderAccessor accessor) {
                String destination = accessor.getDestination();
                if (destination == null || destination.isBlank()) {
                    return;
                }
                Matcher matcher = USER_TOPIC_PATTERN.matcher(destination);
                if (!matcher.matches()) {
                    return;
                }
                Integer authenticatedUserId = extractAuthenticatedUserId(accessor.getUser());
                if (authenticatedUserId == null) {
                    throw new IllegalArgumentException("Không xác định được người dùng để subscribe realtime.");
                }
                Integer requestedUserId = Integer.valueOf(matcher.group(1));
                if (!requestedUserId.equals(authenticatedUserId)) {
                    throw new IllegalArgumentException("Không được phép subscribe vào kênh realtime của người dùng khác.");
                }
            }

            private Integer extractAuthenticatedUserId(Principal principal) {
                if (principal instanceof UsernamePasswordAuthenticationToken authenticationToken) {
                    Object principalObject = authenticationToken.getPrincipal();
                    if (principalObject instanceof UserDetailsImpl userDetails) {
                        return userDetails.getId();
                    }
                }
                return null;
            }

            private UserDetails buildUserDetailsFromToken(String token, String username) {
                Integer userId = jwtUtils.getUserIdFromJwtToken(token);
                String role = jwtUtils.getRoleFromJwtToken(token);
                String status = jwtUtils.getStatusFromJwtToken(token);
                if (userId != null && role != null && status != null) {
                    return UserDetailsImpl.fromJwtClaims(
                            userId,
                            username,
                            jwtUtils.getFullNameFromJwtToken(token),
                            role,
                            status,
                            jwtUtils.getTechTypeIdsFromJwtToken(token),
                            jwtUtils.getTechTypeNamesFromJwtToken(token)
                    );
                }
                return userDetailsService.loadUserByUsername(username);
            }

            private String extractToken(StompHeaderAccessor accessor) {
                String authorization = accessor.getFirstNativeHeader("Authorization");
                if (authorization == null || authorization.isBlank()) {
                    authorization = accessor.getFirstNativeHeader("authorization");
                }
                if (authorization != null && authorization.startsWith("Bearer ")) {
                    return authorization.substring(7);
                }
                if (authorization != null && !authorization.isBlank()) {
                    return authorization;
                }
                String nativeToken = accessor.getFirstNativeHeader("token");
                if (nativeToken != null && !nativeToken.isBlank()) {
                    return nativeToken;
                }
                if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken authenticationToken) {
                    Object credentials = authenticationToken.getCredentials();
                    if (credentials instanceof String credentialToken && !credentialToken.isBlank()) {
                        return credentialToken;
                    }
                }
                return null;
            }
        });
    }
}
