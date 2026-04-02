package com.poly.mhv.controller;

import com.poly.mhv.dto.auth.JwtResponse;
import com.poly.mhv.dto.auth.LoginRequest;
import com.poly.mhv.dto.auth.RegisterRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.UserService;
import jakarta.validation.Valid;
import com.poly.mhv.security.jwt.JwtUtils;
import com.poly.mhv.security.services.UserDetailsImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager, JwtUtils jwtUtils, UserService userService) {
        this.authenticationManager = authenticationManager;
        this.jwtUtils = jwtUtils;
        this.userService = userService;
    }

    @PostMapping("/login")
    public JwtResponse authenticateUser(@RequestBody LoginRequest loginRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword())
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String jwt = jwtUtils.generateJwtToken(userDetails);

            return JwtResponse.builder()
                    .token(jwt)
                    .id(userDetails.getId())
                    .username(userDetails.getUsername())
                    .role(userDetails.getRole())
                    .techTypeId(userDetails.getTechTypeId())
                    .techTypeName(userDetails.getTechTypeName())
                    .build();
        } catch (DisabledException ex) {
            throw new CustomException("Tài khoản đang bị khóa.");
        } catch (BadCredentialsException ex) {
            throw new CustomException("Sai username hoặc password.");
        }
    }

    @PostMapping("/register")
    public JwtResponse register(@Valid @RequestBody RegisterRequest request) {
        var created = userService.register(request);
        return JwtResponse.builder()
                .id(created.getId())
                .username(created.getUsername())
                .role(created.getRole())
                .techTypeId(created.getTechTypeId())
                .techTypeName(created.getTechTypeName())
                .build();
    }

    @GetMapping("/check-username")
    public java.util.Map<String, Boolean> checkUsername(@RequestParam String username) {
        return java.util.Map.of("exists", userService.existsByUsername(username));
    }
}
