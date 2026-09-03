package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.InquiryActionRequest;
import com.poly.mhv.dto.inquiry.InquiryAlternativeRequest;
import com.poly.mhv.dto.inquiry.InquiryAvailabilityResponse;
import com.poly.mhv.dto.inquiry.InquiryConsumableConversionRequest;
import com.poly.mhv.dto.inquiry.InquiryCreateRequest;
import com.poly.mhv.dto.inquiry.InquiryMediaUploadResponse;
import com.poly.mhv.dto.inquiry.InquiryMessageResponse;
import com.poly.mhv.dto.inquiry.InquiryMessageSendRequest;
import com.poly.mhv.dto.inquiry.InquiryOptionsResponse;
import com.poly.mhv.dto.inquiry.InquiryResponse;
import com.poly.mhv.dto.inquiry.InquiryTransferRequest;
import com.poly.mhv.service.InquiryService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/inquiries")
@RequiredArgsConstructor
public class InquiryController {

    private final InquiryService inquiryService;

    @GetMapping("/availability")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<List<InquiryAvailabilityResponse>> searchAvailability(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String trackingMode,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(inquiryService.searchAvailability(keyword, trackingMode, categoryId, locationId, limit));
    }

    @GetMapping("/options")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<InquiryOptionsResponse> getOptions() {
        return ResponseEntity.ok(inquiryService.getOptions());
    }

    @PostMapping
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<InquiryResponse> create(@Valid @RequestBody InquiryCreateRequest request) {
        return ResponseEntity.ok(inquiryService.create(request));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<List<InquiryResponse>> getMine() {
        return ResponseEntity.ok(inquiryService.getMine());
    }

    @GetMapping("/inbox")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<List<InquiryResponse>> getInbox(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(inquiryService.getInbox(status));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.getById(id));
    }

    @GetMapping("/{id}/messages")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<List<InquiryMessageResponse>> getMessages(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.getMessages(id));
    }

    @PostMapping("/{id}/messages")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<InquiryMessageResponse> sendMessage(
            @PathVariable Long id,
            @Valid @RequestBody InquiryMessageSendRequest request) {
        return ResponseEntity.ok(inquiryService.sendMessage(id, request));
    }

    @PostMapping(path = "/{id}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<InquiryMediaUploadResponse> uploadMedia(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(inquiryService.uploadMedia(id, file));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.markRead(id));
    }

    @PostMapping("/{id}/claim")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> claim(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.claim(id));
    }

    @PostMapping("/{id}/transfer")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> transfer(
            @PathVariable Long id,
            @Valid @RequestBody InquiryTransferRequest request) {
        return ResponseEntity.ok(inquiryService.transfer(id, request));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<InquiryResponse> cancel(
            @PathVariable Long id,
            @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(inquiryService.cancel(id, request));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> close(
            @PathVariable Long id,
            @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(inquiryService.close(id, request));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody InquiryActionRequest request) {
        return ResponseEntity.ok(inquiryService.reject(id, request));
    }

    @PostMapping("/{id}/alternative")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryResponse> proposeAlternative(
            @PathVariable Long id,
            @Valid @RequestBody InquiryAlternativeRequest request) {
        return ResponseEntity.ok(inquiryService.proposeAlternative(id, request));
    }

    @PostMapping("/{id}/alternative/accept")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<InquiryResponse> acceptAlternative(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.acceptAlternative(id));
    }

    @PostMapping("/{id}/confirm-receipt")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<InquiryResponse> confirmReceipt(@PathVariable Long id) {
        return ResponseEntity.ok(inquiryService.confirmReceipt(id));
    }

    @PostMapping("/{id}/create-consumable-request")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<InquiryResponse> createConsumableRequest(
            @PathVariable Long id,
            @Valid @RequestBody InquiryConsumableConversionRequest request) {
        return ResponseEntity.ok(inquiryService.createConsumableRequest(id, request));
    }
}
