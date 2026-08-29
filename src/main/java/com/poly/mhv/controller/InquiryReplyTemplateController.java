package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.InquiryReplyTemplateRequest;
import com.poly.mhv.dto.inquiry.InquiryReplyTemplateResponse;
import com.poly.mhv.service.InquiryReplyTemplateService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inquiry-reply-templates")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
public class InquiryReplyTemplateController {

    private final InquiryReplyTemplateService service;

    @GetMapping
    public ResponseEntity<List<InquiryReplyTemplateResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @PostMapping
    public ResponseEntity<InquiryReplyTemplateResponse> create(
            @Valid @RequestBody InquiryReplyTemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InquiryReplyTemplateResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody InquiryReplyTemplateRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
