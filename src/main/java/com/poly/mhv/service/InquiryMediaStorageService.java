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

    public StoredInquiryMedia storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException("Ảnh đính kèm không được để trống.");
        }
        try {
            MediaSecurityService.ValidatedMedia image = mediaSecurityService.validateImage(
                    file.getBytes(),
                    MediaSecurityService.SAFE_IMAGE_MIME_TYPES);
            String url = mediaStorageService.storeBytes(
                    image.bytes(),
                    image.mimeType(),
                    "inquiries/image",
                    image.extension());
            return new StoredInquiryMedia(url, "image");
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu ảnh đính kèm.");
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
