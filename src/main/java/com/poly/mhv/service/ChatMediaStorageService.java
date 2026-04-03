package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ChatMediaStorageService {

    private static final String IMG_PREFIX = "[[IMG]]";
    private static final String AUDIO_PREFIX = "[[AUDIO]]";
    private static final Map<String, String> MIME_EXTENSION = Map.of(
            "image/jpeg", "jpg",
            "image/jpg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif",
            "audio/webm", "webm",
            "audio/mpeg", "mp3",
            "audio/mp3", "mp3",
            "audio/wav", "wav",
            "audio/ogg", "ogg"
    );

    private final Path uploadDir;

    public ChatMediaStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public ProcessedChatPayload processIncomingContent(String rawContent) {
        if (!StringUtils.hasText(rawContent)) {
            throw new CustomException("content là bắt buộc.");
        }
        String normalized = rawContent.trim();
        if (normalized.startsWith("data:")) {
            String expectedType = normalized.startsWith("data:audio/") ? "audio" : "image";
            StoredMedia media = decodeAndStoreDataUrl(normalized, expectedType);
            return new ProcessedChatPayload(null, media.url(), expectedType);
        }
        if (normalized.startsWith(IMG_PREFIX)) {
            String value = normalized.substring(IMG_PREFIX.length());
            if (value.startsWith("data:")) {
                StoredMedia media = decodeAndStoreDataUrl(value, "image");
                return new ProcessedChatPayload(null, media.url(), "image");
            }
            return new ProcessedChatPayload(null, value, "image");
        }
        if (normalized.startsWith(AUDIO_PREFIX)) {
            String value = normalized.substring(AUDIO_PREFIX.length());
            if (value.startsWith("data:")) {
                StoredMedia media = decodeAndStoreDataUrl(value, "audio");
                return new ProcessedChatPayload(null, media.url(), "audio");
            }
            return new ProcessedChatPayload(null, value, "audio");
        }
        return new ProcessedChatPayload(normalized, null, null);
    }

    public ProcessedChatPayload migrateLegacyContent(String rawContent) {
        try {
            return processIncomingContent(rawContent);
        } catch (Exception ex) {
            return null;
        }
    }

    private StoredMedia decodeAndStoreDataUrl(String dataUrl, String expectedType) {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex <= 0) {
            throw new CustomException("Media base64 không hợp lệ.");
        }
        String meta = dataUrl.substring(5, commaIndex);
        String base64 = dataUrl.substring(commaIndex + 1);
        if (!meta.contains(";base64")) {
            throw new CustomException("Media base64 không hợp lệ.");
        }
        String mimeType = meta.substring(0, meta.indexOf(';')).toLowerCase();
        if (!mimeType.startsWith(expectedType + "/")) {
            throw new CustomException("Loại media không hợp lệ.");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw new CustomException("Media base64 không hợp lệ.");
        }
        if (bytes.length == 0) {
            throw new CustomException("Media rỗng.");
        }
        String extension = MIME_EXTENSION.getOrDefault(mimeType, expectedType.equals("image") ? "jpg" : "bin");
        String fileName = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(uploadDir);
            Path filePath = uploadDir.resolve(fileName).normalize();
            Files.write(filePath, bytes, StandardOpenOption.CREATE_NEW);
            return new StoredMedia("/uploads/" + fileName, mimeType);
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu media.");
        }
    }

    public record ProcessedChatPayload(String content, String mediaUrl, String mediaType) {}
    private record StoredMedia(String url, String mimeType) {}
}
