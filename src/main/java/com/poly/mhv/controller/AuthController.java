package com.poly.mhv.controller;

import com.poly.mhv.dto.auth.JwtResponse;
import com.poly.mhv.dto.auth.LoginRequest;
import com.poly.mhv.dto.auth.RegisterRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.poly.mhv.security.jwt.JwtUtils;
import com.poly.mhv.security.services.UserDetailsImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/auth", "/auth"})
@Tag(name = "Xác thực", description = "API đăng nhập, đăng ký và kiểm tra tài khoản")
@Validated
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
    @Operation(summary = "Đăng nhập", description = "Xác thực người dùng và trả về JWT để gọi các API bảo vệ.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đăng nhập thành công"),
            @ApiResponse(responseCode = "400", description = "Sai username hoặc password, hoặc tài khoản bị khóa")
    })
    public JwtResponse authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
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
                    .fullName(userDetails.getFullName())
                    .role(userDetails.getRole())
                    .techTypeIds(userDetails.getTechTypeIds())
                    .techTypeNames(userDetails.getTechTypeNames())
                    .build();
        } catch (DisabledException ex) {
            throw new CustomException("Tài khoản đang bị khóa.");
        } catch (BadCredentialsException ex) {
            throw new CustomException("Sai username hoặc password.");
        }
    }

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản", description = "Tạo mới tài khoản người dùng theo dữ liệu đăng ký.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đăng ký thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc username đã tồn tại")
    })
    public JwtResponse register(@Valid @RequestBody RegisterRequest request) {
        var created = userService.register(request);
        return JwtResponse.builder()
                .id(created.getId())
                .username(created.getUsername())
                .fullName(created.getFullName())
                .role(created.getRole())
                .techTypeIds(created.getTechTypeIds())
                .techTypeNames(created.getTechTypeNames())
                .build();
    }

    @GetMapping("/check-username")
    @Operation(summary = "Kiểm tra username", description = "Kiểm tra username đã tồn tại trong hệ thống hay chưa.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Kiểm tra thành công")
    })
    public java.util.Map<String, Boolean> checkUsername(
            @RequestParam
            @Size(min = 4, max = 50, message = "Username phải từ 4 đến 50 ký tự.")
            @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username chỉ được chứa chữ cái, số và dấu gạch dưới.")
            String username
    ) {
        return java.util.Map.of("exists", userService.existsByUsername(username));
    }
}
