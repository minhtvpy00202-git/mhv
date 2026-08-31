package com.poly.mhv.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.poly.mhv.dto.auth.LoginRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.security.jwt.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.LockedException;

class AuthControllerTest {

    @Test
    void lockedAccountReturnsControlledBusinessError() {
        AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
        when(authenticationManager.authenticate(any())).thenThrow(new LockedException("locked"));
        AuthController controller = new AuthController(authenticationManager, mock(JwtUtils.class));

        CustomException error = assertThrows(
                CustomException.class,
                () -> controller.authenticateUser(LoginRequest.builder()
                        .username("techsup5")
                        .password("123456")
                        .build()));

        assertEquals("Tài khoản đang bị khóa.", error.getMessage());
    }
}
