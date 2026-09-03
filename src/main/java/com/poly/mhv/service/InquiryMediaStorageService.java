package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class InquiryMediaStorageService {

    private final MediaStorageService mediaStorageService;
    private final MediaSecurityService mediaSecurityService;

    public InquiryMediaStorageService(
            MediaStorageService mediaStorageService,
            MediaSecurityService mediaSecurityService) {
        this.mediaStorageService = mediaStorageService;
        this.mediaSecurityService = mediaSecurityService;
    }

    public StoredInquiryMedia storeMedia(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException("Media đính kèm không được để trống.");
        }
        try {
            byte[] bytes = file.getBytes();
            MediaSecurityService.ValidatedMedia media;
            try {
                media = mediaSecurityService.validateImage(bytes, MediaSecurityService.SAFE_IMAGE_MIME_TYPES);
            } catch (CustomException ignored) {
                media = mediaSecurityService.validateAudio(bytes);
            }
            String url = mediaStorageService.storeBytes(
                    media.bytes(),
                    media.mimeType(),
                    "inquiries/" + media.category(),
                    media.extension());
            return new StoredInquiryMedia(url, media.category());
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu media đính kèm.");
        }
    }

    public String normalizeTrustedUrl(String url) {
        String normalized = mediaSecurityService.normalizeStoredMediaUrl(url);
        if (normalized == null || !normalized.replace('\\', '/').contains("/uploads/inquiries/")) {
            throw new CustomException("Đường dẫn media của yêu cầu không hợp lệ.");
        }
        return normalized;
    }

    public record StoredInquiryMedia(String mediaUrl, String mediaType) {
    }
}
