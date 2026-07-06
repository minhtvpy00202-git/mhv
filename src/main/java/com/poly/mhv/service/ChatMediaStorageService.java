package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.util.Base64;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ChatMediaStorageService {

    private static final String IMG_PREFIX = "[[IMG]]";
    private static final String AUDIO_PREFIX = "[[AUDIO]]";

    private final MediaStorageService mediaStorageService;
    private final MediaSecurityService mediaSecurityService;

    public ChatMediaStorageService(
            MediaStorageService mediaStorageService,
            MediaSecurityService mediaSecurityService
    ) {
        this.mediaStorageService = mediaStorageService;
        this.mediaSecurityService = mediaSecurityService;
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
            return new ProcessedChatPayload(null, normalizeTrustedMediaUrl(value), "image");
        }
        if (normalized.startsWith(AUDIO_PREFIX)) {
            String value = normalized.substring(AUDIO_PREFIX.length());
            if (value.startsWith("data:")) {
                StoredMedia media = decodeAndStoreDataUrl(value, "audio");
                return new ProcessedChatPayload(null, media.url(), "audio");
            }
            return new ProcessedChatPayload(null, normalizeTrustedMediaUrl(value), "audio");
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

    public ProcessedChatPayload storeUploadedFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException("File media không được để trống.");
        }
        try {
            byte[] bytes = file.getBytes();
            try {
                MediaSecurityService.ValidatedMedia image = mediaSecurityService.validateImage(
                        bytes,
                        MediaSecurityService.SAFE_IMAGE_MIME_TYPES
                );
                return storeValidatedMedia(image);
            } catch (CustomException ignored) {
                MediaSecurityService.ValidatedMedia audio = mediaSecurityService.validateAudio(bytes);
                return storeValidatedMedia(audio);
            }
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu media.");
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
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw new CustomException("Media base64 không hợp lệ.");
        }
        if (bytes.length == 0) {
            throw new CustomException("Media rỗng.");
        }
        try {
            MediaSecurityService.ValidatedMedia media = "image".equals(expectedType)
                    ? mediaSecurityService.validateImage(bytes, MediaSecurityService.SAFE_IMAGE_MIME_TYPES)
                    : mediaSecurityService.validateAudio(bytes);
            if (!expectedType.equalsIgnoreCase(media.category())) {
                throw new CustomException("Loại media không hợp lệ.");
            }
            return new StoredMedia(
                    mediaStorageService.storeBytes(media.bytes(), media.mimeType(), resolvePrefix(media.category()), media.extension()),
                    media.mimeType()
            );
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu media.");
        }
    }

    public String normalizeTrustedMediaUrl(String rawMediaUrl) {
        return mediaSecurityService.normalizeStoredMediaUrl(rawMediaUrl);
    }

    private ProcessedChatPayload storeValidatedMedia(MediaSecurityService.ValidatedMedia media) {
        return new ProcessedChatPayload(
                null,
                mediaStorageService.storeBytes(media.bytes(), media.mimeType(), resolvePrefix(media.category()), media.extension()),
                media.category()
        );
    }

    private String resolvePrefix(String logicalType) {
        return "audio".equalsIgnoreCase(logicalType) ? "chat/audio" : "chat/image";
    }

    public record ProcessedChatPayload(String content, String mediaUrl, String mediaType) {}
    private record StoredMedia(String url, String mimeType) {}
}
