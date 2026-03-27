package com.poly.mhv.controller;

import com.poly.mhv.service.AdminAlertSseService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/alerts")
public class AdminAlertController {

    private final AdminAlertSseService adminAlertSseService;

    public AdminAlertController(AdminAlertSseService adminAlertSseService) {
        this.adminAlertSseService = adminAlertSseService;
    }

    @GetMapping("/stream")
    public SseEmitter stream() {
        return adminAlertSseService.subscribe();
    }
}
