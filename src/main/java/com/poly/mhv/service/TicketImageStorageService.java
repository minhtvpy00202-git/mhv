package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.util.Base64;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TicketImageStorageService {

    private static final Set<String> ALLOWED_TICKET_IMAGE_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );

    private final MediaStorageService mediaStorageService;
    private final MediaSecurityService mediaSecurityService;

    public TicketImageStorageService(
            MediaStorageService mediaStorageService,
            MediaSecurityService mediaSecurityService
    ) {
        this.mediaStorageService = mediaStorageService;
        this.mediaSecurityService = mediaSecurityService;
    }

    public String normalizeTicketImageUrl(String rawImageUrl) {
        if (!StringUtils.hasText(rawImageUrl)) {
            return null;
        }
        String normalized = rawImageUrl.trim();
        if (normalized.startsWith("data:")) {
            return decodeAndStoreDataUrl(normalized);
        }
        return mediaSecurityService.normalizeStoredMediaUrl(normalized);
    }

    public String toPublicImageUrl(String rawImageUrl) {
        if (!StringUtils.hasText(rawImageUrl)) {
            return null;
        }
        try {
            return mediaSecurityService.normalizeStoredMediaUrl(rawImageUrl);
        } catch (CustomException ex) {
            return null;
        }
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        return writeBytes(file);
    }

    private String decodeAndStoreDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex <= 0) {
            throw new CustomException("Ảnh ticket base64 không hợp lệ.");
        }
        String meta = dataUrl.substring(5, commaIndex);
        String base64 = dataUrl.substring(commaIndex + 1);
        if (!meta.contains(";base64")) {
            throw new CustomException("Ảnh ticket base64 không hợp lệ.");
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            if (bytes.length == 0) {
                throw new CustomException("Ảnh ticket rỗng.");
            }
            MediaSecurityService.ValidatedMedia media = mediaSecurityService.validateImage(bytes, ALLOWED_TICKET_IMAGE_MIME_TYPES);
            return mediaStorageService.storeBytes(media.bytes(), media.mimeType(), "tickets", media.extension());
        } catch (IllegalArgumentException ex) {
            throw new CustomException("Ảnh ticket base64 không hợp lệ.");
        } catch (CustomException ex) {
            throw ex;
        }
    }

    private String writeBytes(MultipartFile file) {
        try {
            MediaSecurityService.ValidatedMedia media = mediaSecurityService.validateImage(
                    file.getBytes(),
                    ALLOWED_TICKET_IMAGE_MIME_TYPES
            );
            return mediaStorageService.storeBytes(media.bytes(), media.mimeType(), "tickets", media.extension());
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu ảnh ticket.");
        }
    }
}
