package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TicketImageStorageService {

    private static final Map<String, String> MIME_EXTENSION = Map.of(
            "image/jpeg", "jpg",
            "image/jpg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif"
    );

    private final Path uploadDir;
    private final MediaStorageService mediaStorageService;

    public TicketImageStorageService(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            MediaStorageService mediaStorageService
    ) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.mediaStorageService = mediaStorageService;
    }

    public String normalizeTicketImageUrl(String rawImageUrl) {
        if (!StringUtils.hasText(rawImageUrl)) {
            return null;
        }
        String normalized = rawImageUrl.trim();
        if (normalized.startsWith("data:")) {
            return decodeAndStoreDataUrl(normalized);
        }
        return toPublicImageUrl(normalized);
    }

    public String toPublicImageUrl(String rawImageUrl) {
        if (!StringUtils.hasText(rawImageUrl)) {
            return null;
        }

        String normalized = rawImageUrl.trim().replace('\\', '/');
        if (!StringUtils.hasText(normalized)) {
            return null;
        }

        if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("data:")) {
            return normalized;
        }

        if (normalized.startsWith("/api/uploads/")) {
            return normalized.substring(4);
        }

        if (normalized.startsWith("/uploads/")) {
            return normalized;
        }

        if (normalized.startsWith("uploads/")) {
            return "/" + normalized;
        }

        int uploadsIndex = normalized.indexOf("/uploads/");
        if (uploadsIndex >= 0) {
            return normalized.substring(uploadsIndex);
        }

        Path normalizedUploadDir = uploadDir.normalize();
        Path candidatePath = Paths.get(normalized).normalize();
        if (candidatePath.startsWith(normalizedUploadDir) && candidatePath.getFileName() != null) {
            Path relativePath = normalizedUploadDir.relativize(candidatePath).normalize();
            return "/uploads/" + relativePath.toString().replace('\\', '/');
        }

        return normalized;
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String mimeType = StringUtils.hasText(file.getContentType())
                ? file.getContentType().trim().toLowerCase()
                : null;
        if (!StringUtils.hasText(mimeType) || !mimeType.startsWith("image/")) {
            throw new CustomException("Ảnh ticket không hợp lệ.");
        }
        return writeBytes(file, mimeType);
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
        String mimeType = meta.substring(0, meta.indexOf(';')).toLowerCase();
        if (!mimeType.startsWith("image/")) {
            throw new CustomException("Ảnh ticket không hợp lệ.");
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            if (bytes.length == 0) {
                throw new CustomException("Ảnh ticket rỗng.");
            }
            String extension = MIME_EXTENSION.getOrDefault(mimeType, "jpg");
            return mediaStorageService.storeBytes(bytes, mimeType, "tickets", extension);
        } catch (IllegalArgumentException ex) {
            throw new CustomException("Ảnh ticket base64 không hợp lệ.");
        } catch (CustomException ex) {
            throw ex;
        }
    }

    private String writeBytes(MultipartFile file, String mimeType) {
        String extension = MIME_EXTENSION.getOrDefault(mimeType, "jpg");
        try {
            return mediaStorageService.storeBytes(file.getBytes(), mimeType, "tickets", extension);
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu ảnh ticket.");
        }
    }
}
