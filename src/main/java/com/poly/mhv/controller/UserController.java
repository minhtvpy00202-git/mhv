package com.poly.mhv.controller;

import com.poly.mhv.dto.user.UserOptionResponse;
import com.poly.mhv.repository.AppUserRepository;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository appUserRepository;

    public UserController(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @GetMapping("/borrowers")
    public ResponseEntity<List<UserOptionResponse>> getBorrowers() {
        List<UserOptionResponse> users = appUserRepository.findAllByOrderByUsernameAsc().stream()
                .map(user -> UserOptionResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .build())
                .toList();
        return ResponseEntity.ok(users);
    }
}
