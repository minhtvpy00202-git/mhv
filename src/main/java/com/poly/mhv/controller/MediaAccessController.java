package com.poly.mhv.controller;

import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.MediaSecurityService;
import com.poly.mhv.service.MediaStorageService;
import com.poly.mhv.service.ChatMediaAccessService;
import com.poly.mhv.service.InquiryMediaAccessService;
import com.poly.mhv.service.TicketMediaAccessService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/media")
public class MediaAccessController {

    private final MediaSecurityService mediaSecurityService;
    private final TicketMediaAccessService ticketMediaAccessService;
    private final ChatMediaAccessService chatMediaAccessService;
    private final InquiryMediaAccessService inquiryMediaAccessService;
    private final MediaStorageService mediaStorageService;

    public MediaAccessController(
            MediaSecurityService mediaSecurityService,
            TicketMediaAccessService ticketMediaAccessService,
            ChatMediaAccessService chatMediaAccessService,
            InquiryMediaAccessService inquiryMediaAccessService,
            MediaStorageService mediaStorageService) {
        this.mediaSecurityService = mediaSecurityService;
        this.ticketMediaAccessService = ticketMediaAccessService;
        this.chatMediaAccessService = chatMediaAccessService;
        this.inquiryMediaAccessService = inquiryMediaAccessService;
        this.mediaStorageService = mediaStorageService;
    }

    @GetMapping("/**")
    public ResponseEntity<byte[]> getMedia(HttpServletRequest request) {
        String contextPath = request.getContextPath() == null ? "" : request.getContextPath();
        String requestUri = request.getRequestURI();
        String prefix = contextPath + "/api/media/";
        if (!requestUri.startsWith(prefix)) {
            return ResponseEntity.notFound().build();
        }

        String mediaPath = requestUri.substring(prefix.length());
        try {
            if (mediaPath.startsWith("uploads/tickets/")) {
                ticketMediaAccessService.ensureCanRead("/" + mediaPath);
            } else if (mediaPath.startsWith("uploads/chat/")) {
                chatMediaAccessService.ensureCanRead("/" + mediaPath);
            } else if (mediaPath.startsWith("uploads/inquiries/")) {
                inquiryMediaAccessService.ensureCanRead("/" + mediaPath);
            }
            MediaSecurityService.ValidatedMedia media;
            String fileName;
            if (mediaStorageService.isSpacesProvider()) {
                MediaStorageService.StoredObject storedObject = mediaStorageService.readStoredObject(mediaPath);
                media = mediaSecurityService.inspectStoredMediaBytes(storedObject.bytes());
                fileName = storedObject.fileName();
            } else {
                Path path = mediaSecurityService.resolveLocalMediaPath(mediaPath);
                media = mediaSecurityService.inspectStoredLocalMedia(path);
                fileName = path.getFileName().toString();
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(media.mimeType()));
            headers.setContentDisposition(ContentDisposition.inline()
                    .filename(fileName, StandardCharsets.UTF_8)
                    .build());
            headers.setCacheControl(CacheControl.noStore().getHeaderValue());
            headers.set("X-Content-Type-Options", "nosniff");

            return new ResponseEntity<>(media.bytes(), headers, HttpStatus.OK);
        } catch (CustomException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
