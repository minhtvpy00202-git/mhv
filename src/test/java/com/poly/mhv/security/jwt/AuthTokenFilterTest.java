package com.poly.mhv.security.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.security.services.UserDetailsImpl;
import com.poly.mhv.security.services.UserDetailsServiceImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

class AuthTokenFilterTest {

    private final JwtUtils jwtUtils = mock(JwtUtils.class);
    private final UserDetailsServiceImpl userDetailsService = mock(UserDetailsServiceImpl.class);
    private final AuthTokenFilter filter = new AuthTokenFilter(jwtUtils, userDetailsService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void oldTokenIsRejectedImmediatelyAfterAccountIsLocked() throws Exception {
        HttpServletRequest request = requestWithBearerToken("old-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(jwtUtils.validateJwtToken("old-token")).thenReturn(true);
        when(jwtUtils.getUserNameFromJwtToken("old-token")).thenReturn("techsup1");
        when(userDetailsService.loadUserByUsername("techsup1"))
                .thenReturn(details(3, "techsup1", "TechSupport", "Khóa"));

        filter.doFilterInternal(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }

    @Test
    void currentDatabaseRoleOverridesStaleRoleInsideToken() throws Exception {
        HttpServletRequest request = requestWithBearerToken("stale-role-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(jwtUtils.validateJwtToken("stale-role-token")).thenReturn(true);
        when(jwtUtils.getUserNameFromJwtToken("stale-role-token")).thenReturn("nhanvien");
        when(userDetailsService.loadUserByUsername("nhanvien"))
                .thenReturn(details(1, "nhanvien", "NhanVien", "Hoạt động"));

        filter.doFilterInternal(request, response, chain);

        assertEquals(
                "ROLE_NhanVien",
                SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority());
    }

    private HttpServletRequest requestWithBearerToken(String token) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        return request;
    }

    private UserDetailsImpl details(Integer id, String username, String role, String status) {
        return UserDetailsImpl.build(AppUser.builder()
                .id(id)
                .username(username)
                .password("encoded")
                .role(role)
                .status(status)
                .build());
    }
}
