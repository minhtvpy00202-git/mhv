package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MediaSecurityService {

    public static final Set<String> SAFE_IMAGE_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    public static final Set<String> SAFE_AUDIO_MIME_TYPES = Set.of(
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/webm"
    );

    private final Path uploadDir;
    private final String spacesPublicBaseUrl;

    public MediaSecurityService(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.spaces.public-base-url:}") String spacesPublicBaseUrl
    ) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.spacesPublicBaseUrl = StringUtils.hasText(spacesPublicBaseUrl)
                ? spacesPublicBaseUrl.trim().replaceAll("/+$", "")
                : "";
    }

    public ValidatedMedia validateImage(byte[] bytes, Set<String> allowedMimeTypes) {
        String mimeType = detectMimeType(bytes);
        if (!StringUtils.hasText(mimeType) || !SAFE_IMAGE_MIME_TYPES.contains(mimeType)) {
            throw new CustomException("Ảnh không hợp lệ.");
        }
        if (allowedMimeTypes != null && !allowedMimeTypes.isEmpty() && !allowedMimeTypes.contains(mimeType)) {
            throw new CustomException("Định dạng ảnh không được hỗ trợ.");
        }
        if (requiresRasterValidation(mimeType) && !isReadableImage(bytes)) {
            throw new CustomException("Ảnh không hợp lệ.");
        }
        return new ValidatedMedia(bytes, mimeType, extensionForMimeType(mimeType), "image");
    }

    public ValidatedMedia validateAudio(byte[] bytes) {
        String mimeType = detectMimeType(bytes);
        if (!StringUtils.hasText(mimeType) || !SAFE_AUDIO_MIME_TYPES.contains(mimeType)) {
            throw new CustomException("Media âm thanh không hợp lệ.");
        }
        return new ValidatedMedia(bytes, mimeType, extensionForMimeType(mimeType), "audio");
    }

    public ValidatedMedia inspectStoredLocalMedia(Path path) {
        try {
            return inspectStoredMediaBytes(Files.readAllBytes(path));
        } catch (IOException ex) {
            throw new CustomException("Không thể đọc media.");
        }
    }

    public ValidatedMedia inspectStoredMediaBytes(byte[] bytes) {
        String mimeType = detectMimeType(bytes);
        if (!StringUtils.hasText(mimeType)) {
            throw new CustomException("Media không hợp lệ.");
        }
        boolean safeImage = SAFE_IMAGE_MIME_TYPES.contains(mimeType);
        boolean safeAudio = SAFE_AUDIO_MIME_TYPES.contains(mimeType);
        if (!safeImage && !safeAudio) {
            throw new CustomException("Media không hợp lệ.");
        }
        if (safeImage && requiresRasterValidation(mimeType) && !isReadableImage(bytes)) {
            throw new CustomException("Media không hợp lệ.");
        }
        return new ValidatedMedia(bytes, mimeType, extensionForMimeType(mimeType), safeImage ? "image" : "audio");
    }

    public String normalizeStoredMediaUrl(String rawUrl) {
        if (!StringUtils.hasText(rawUrl)) {
            return null;
        }
        String normalized = rawUrl.trim().replace('\\', '/');
        if (!StringUtils.hasText(normalized)) {
            return null;
        }
        if (normalized.startsWith("/api/media/uploads/")) {
            return normalized.substring("/api/media".length());
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
        if (isTrustedExternalMediaUrl(normalized)) {
            return normalized;
        }
        try {
            Path candidatePath = Paths.get(normalized).normalize();
            if (candidatePath.startsWith(uploadDir) && candidatePath.getFileName() != null) {
                Path relativePath = uploadDir.relativize(candidatePath).normalize();
                return "/uploads/" + relativePath.toString().replace('\\', '/');
            }
        } catch (InvalidPathException ignored) {
            // fallback to invalid-path handling below
        }
        throw new CustomException("Đường dẫn media không hợp lệ.");
    }

    public Path resolveLocalMediaPath(String requestPath) {
        if (!StringUtils.hasText(requestPath)) {
            throw new CustomException("Đường dẫn media không hợp lệ.");
        }
        String normalized = requestPath.trim().replace('\\', '/');
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.startsWith("uploads/")) {
            normalized = normalized.substring("uploads/".length());
        }
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Đường dẫn media không hợp lệ.");
        }
        try {
            Path resolved = uploadDir.resolve(normalized).normalize();
            if (!resolved.startsWith(uploadDir) || Files.isDirectory(resolved) || !Files.exists(resolved)) {
                throw new CustomException("Không tìm thấy media.");
            }
            return resolved;
        } catch (InvalidPathException ex) {
            throw new CustomException("Đường dẫn media không hợp lệ.");
        }
    }

    private boolean isTrustedExternalMediaUrl(String normalized) {
        if (!StringUtils.hasText(normalized)) {
            return false;
        }
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            return false;
        }
        return StringUtils.hasText(spacesPublicBaseUrl)
                && normalized.startsWith(spacesPublicBaseUrl + "/");
    }

    private boolean requiresRasterValidation(String mimeType) {
        return !"image/webp".equalsIgnoreCase(mimeType);
    }

    private boolean isReadableImage(byte[] bytes) {
        try (ByteArrayInputStream inputStream = new ByteArrayInputStream(bytes)) {
            return ImageIO.read(inputStream) != null;
        } catch (IOException ex) {
            return false;
        }
    }

    private String detectMimeType(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return null;
        }
        if (matches(bytes, new int[]{0xFF, 0xD8, 0xFF})) {
            return "image/jpeg";
        }
        if (matches(bytes, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})) {
            return "image/png";
        }
        if (matchesAscii(bytes, 0, "GIF87a") || matchesAscii(bytes, 0, "GIF89a")) {
            return "image/gif";
        }
        if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) {
            return "image/webp";
        }
        if (matchesAscii(bytes, 0, "OggS")) {
            return "audio/ogg";
        }
        if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WAVE")) {
            return "audio/wav";
        }
        if (matches(bytes, new int[]{0x1A, 0x45, 0xDF, 0xA3})) {
            return "audio/webm";
        }
        if (matchesAscii(bytes, 0, "ID3") || looksLikeMp3Frame(bytes)) {
            return "audio/mpeg";
        }
        return null;
    }

    private boolean looksLikeMp3Frame(byte[] bytes) {
        if (bytes == null || bytes.length < 2) {
            return false;
        }
        int first = bytes[0] & 0xFF;
        int second = bytes[1] & 0xFF;
        return first == 0xFF && (second & 0xE0) == 0xE0;
    }

    private boolean matches(byte[] bytes, int[] signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        for (int index = 0; index < signature.length; index++) {
            if ((bytes[index] & 0xFF) != signature[index]) {
                return false;
            }
        }
        return true;
    }

    private boolean matchesAscii(byte[] bytes, int offset, String value) {
        if (bytes.length < offset + value.length()) {
            return false;
        }
        byte[] expected = value.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        for (int index = 0; index < expected.length; index++) {
            if (bytes[offset + index] != expected[index]) {
                return false;
            }
        }
        return true;
    }

    private String extensionForMimeType(String mimeType) {
        String normalized = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            case "audio/mpeg" -> "mp3";
            case "audio/wav" -> "wav";
            case "audio/ogg" -> "ogg";
            case "audio/webm" -> "webm";
            default -> throw new CustomException("Định dạng media không hợp lệ.");
        };
    }

    public record ValidatedMedia(byte[] bytes, String mimeType, String extension, String category) {}
}
