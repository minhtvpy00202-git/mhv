package com.poly.mhv.config;

import com.poly.mhv.security.jwt.JwtUtils;
import com.poly.mhv.security.services.UserDetailsServiceImpl;
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
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtils jwtUtils;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
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
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String token = extractToken(accessor);
                    if (token == null || token.isBlank()) {
                        throw new IllegalArgumentException("Thiếu JWT token trong CONNECT headers.");
                    }

                    String username = jwtUtils.getUserNameFromJwtToken(token);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    if (!jwtUtils.validateJwtToken(token, userDetails)) {
                        throw new IllegalArgumentException("JWT token không hợp lệ.");
                    }

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    accessor.setUser(authentication);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
                return message;
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
