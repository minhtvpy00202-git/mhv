package com.poly.mhv.controller;

import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.MediaSecurityService;
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
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/media")
public class MediaAccessController {

    private final MediaSecurityService mediaSecurityService;

    public MediaAccessController(MediaSecurityService mediaSecurityService) {
        this.mediaSecurityService = mediaSecurityService;
    }

    @GetMapping("/**")
    public ResponseEntity<byte[]> getMedia(HttpServletRequest request) {
        String contextPath = request.getContextPath() == null ? "" : request.getContextPath();
        String requestUri = request.getRequestURI();
        String prefix = contextPath + "/api/media/";
        if (!requestUri.startsWith(prefix)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        String mediaPath = requestUri.substring(prefix.length());
        try {
            Path path = mediaSecurityService.resolveLocalMediaPath(mediaPath);
            MediaSecurityService.ValidatedMedia media = mediaSecurityService.inspectStoredLocalMedia(path);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(media.mimeType()));
            headers.setContentDisposition(ContentDisposition.inline()
                    .filename(path.getFileName().toString(), StandardCharsets.UTF_8)
                    .build());
            headers.setCacheControl(CacheControl.noStore().getHeaderValue());
            headers.set("X-Content-Type-Options", "nosniff");

            return new ResponseEntity<>(media.bytes(), headers, HttpStatus.OK);
        } catch (CustomException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy media.");
        }
    }
}
