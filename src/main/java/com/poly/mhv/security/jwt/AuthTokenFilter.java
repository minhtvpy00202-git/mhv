package com.poly.mhv.security.jwt;

import com.poly.mhv.security.services.UserDetailsServiceImpl;
import com.poly.mhv.security.services.UserDetailsImpl;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserDetailsServiceImpl userDetailsService;

    public AuthTokenFilter(JwtUtils jwtUtils, UserDetailsServiceImpl userDetailsService) {
        this.jwtUtils = jwtUtils;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String jwt = parseJwt(request);
            if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                String username = jwtUtils.getUserNameFromJwtToken(jwt);
                UserDetailsImpl userDetails = buildUserDetailsFromToken(jwt, username);
                if (jwtUtils.validateJwtToken(jwt)) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (JwtException | IllegalArgumentException ignored) {
        }
        filterChain.doFilter(request, response);
    }

    private UserDetailsImpl buildUserDetailsFromToken(String jwt, String username) {
        Integer userId = jwtUtils.getUserIdFromJwtToken(jwt);
        String role = jwtUtils.getRoleFromJwtToken(jwt);
        String status = jwtUtils.getStatusFromJwtToken(jwt);
        if (userId != null && role != null && status != null) {
            return UserDetailsImpl.fromJwtClaims(
                    userId,
                    username,
                    jwtUtils.getFullNameFromJwtToken(jwt),
                    role,
                    status,
                    jwtUtils.getTechTypeIdsFromJwtToken(jwt),
                    jwtUtils.getTechTypeNamesFromJwtToken(jwt)
            );
        }
        return (UserDetailsImpl) userDetailsService.loadUserByUsername(username);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");
        if (headerAuth != null && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }
        String queryToken = request.getParameter("token");
        if (queryToken != null && !queryToken.isBlank()) {
            return queryToken.trim();
        }
        return null;
    }
}
