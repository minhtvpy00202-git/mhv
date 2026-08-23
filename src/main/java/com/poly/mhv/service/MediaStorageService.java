package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Slf4j
@Service
public class MediaStorageService {

    private final String storageProvider;
    private final Path uploadDir;
    private final String spacesBucket;
    private final String spacesRegion;
    private final String spacesPublicBaseUrl;
    private final S3Client s3Client;

    public MediaStorageService(
            @Value("${app.storage.provider:local}") String storageProvider,
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.spaces.bucket:}") String spacesBucket,
            @Value("${app.spaces.region:}") String spacesRegion,
            @Value("${app.spaces.endpoint:}") String spacesEndpoint,
            @Value("${app.spaces.access-key:}") String spacesAccessKey,
            @Value("${app.spaces.secret-key:}") String spacesSecretKey,
            @Value("${app.spaces.public-base-url:}") String spacesPublicBaseUrl
    ) {
        this.storageProvider = StringUtils.hasText(storageProvider) ? storageProvider.trim().toLowerCase() : "local";
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.spacesBucket = spacesBucket != null ? spacesBucket.trim() : "";
        this.spacesRegion = spacesRegion != null ? spacesRegion.trim() : "";
        this.spacesPublicBaseUrl = spacesPublicBaseUrl != null ? spacesPublicBaseUrl.trim() : "";
        this.s3Client = createS3ClientIfNeeded(spacesRegion, spacesEndpoint, spacesAccessKey, spacesSecretKey);
    }

    public String storeBytes(byte[] bytes, String mimeType, String objectPrefix, String extension) {
        if (bytes == null || bytes.length == 0) {
            throw new CustomException("File media rỗng.");
        }
        if (!StringUtils.hasText(mimeType)) {
            throw new CustomException("Không xác định được loại media.");
        }
        if (!StringUtils.hasText(extension)) {
            extension = "bin";
        }

        String safePrefix = normalizeObjectPrefix(objectPrefix);
        String fileName = UUID.randomUUID() + "." + extension;
        String objectKey = safePrefix.isEmpty() ? fileName : safePrefix + "/" + fileName;

        if (isSpacesProvider()) {
            return uploadToSpaces(bytes, mimeType, objectKey);
        }
        return storeToLocalDisk(bytes, objectKey);
    }

    public boolean isSpacesProvider() {
        return "spaces".equals(storageProvider);
    }

    @PostConstruct
    public void logStorageConfiguration() {
        if (isSpacesProvider()) {
            log.info(
                    "Media storage provider: spaces; bucket='{}', region='{}', endpoint='{}', publicBaseUrl='{}'",
                    spacesBucket,
                    StringUtils.hasText(spacesRegion) ? spacesRegion : "<empty>",
                    sanitizeUrlForLog(resolveConfiguredEndpoint()),
                    sanitizeUrlForLog(spacesPublicBaseUrl)
            );
            warnIfLikelyMisconfiguredEndpoint();
            return;
        }

        log.warn("Media storage provider is '{}'; uploads will be stored on local disk at '{}'. On redeploy, local files may be lost.", storageProvider, uploadDir);
    }

    private S3Client createS3ClientIfNeeded(
            String spacesRegion,
            String spacesEndpoint,
            String spacesAccessKey,
            String spacesSecretKey
    ) {
        if (!isSpacesProvider()) {
            return null;
        }
        if (!StringUtils.hasText(spacesBucket)
                || !StringUtils.hasText(spacesRegion)
                || !StringUtils.hasText(spacesEndpoint)
                || !StringUtils.hasText(spacesAccessKey)
                || !StringUtils.hasText(spacesSecretKey)) {
            throw new IllegalStateException(
                    "Thiếu cấu hình DigitalOcean Spaces. Hãy đặt app.spaces.bucket, region, endpoint, access-key, secret-key."
            );
        }

        return S3Client.builder()
                .region(Region.of(spacesRegion.trim()))
                .endpointOverride(URI.create(spacesEndpoint.trim()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(spacesAccessKey.trim(), spacesSecretKey.trim())
                ))
                .forcePathStyle(false)
                .build();
    }

    private String uploadToSpaces(byte[] bytes, String mimeType, String objectKey) {
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(spacesBucket)
                    .key(objectKey)
                    .contentType(mimeType)
                    .build();
            s3Client.putObject(request, RequestBody.fromBytes(bytes));
            return "/uploads/" + objectKey.replace('\\', '/');
        } catch (Exception ex) {
            throw new CustomException("Không thể upload media lên DigitalOcean Spaces.");
        }
    }

    private String storeToLocalDisk(byte[] bytes, String objectKey) {
        try {
            Path targetPath = uploadDir.resolve(objectKey).normalize();
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, bytes, StandardOpenOption.CREATE_NEW);
            return "/uploads/" + objectKey.replace('\\', '/');
        } catch (Exception ex) {
            throw new CustomException("Không thể lưu media.");
        }
    }

    public StoredObject readStoredObject(String requestPath) {
        if (!isSpacesProvider() || s3Client == null) {
            throw new CustomException("Kho media từ xa chưa được cấu hình.");
        }
        String objectKey = normalizeObjectKey(requestPath);
        try {
            byte[] bytes = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(spacesBucket)
                    .key(objectKey)
                    .build()).asByteArray();
            String fileName = objectKey.substring(objectKey.lastIndexOf('/') + 1);
            return new StoredObject(bytes, fileName);
        } catch (Exception ex) {
            throw new CustomException("Không thể đọc media từ kho lưu trữ.");
        }
    }

    private String normalizeObjectKey(String requestPath) {
        if (!StringUtils.hasText(requestPath)) {
            throw new CustomException("Đường dẫn media không hợp lệ.");
        }
        String normalized = requestPath.trim().replace('\\', '/').replaceAll("^/+", "");
        if (normalized.startsWith("uploads/")) {
            normalized = normalized.substring("uploads/".length());
        }
        if (!StringUtils.hasText(normalized) || normalized.contains("../") || normalized.contains("/..")) {
            throw new CustomException("Đường dẫn media không hợp lệ.");
        }
        return normalized;
    }

    private void warnIfLikelyMisconfiguredEndpoint() {
        String endpoint = resolveConfiguredEndpoint();
        if (!StringUtils.hasText(endpoint) || !StringUtils.hasText(spacesBucket)) {
            return;
        }
        try {
            String host = URI.create(endpoint.trim()).getHost();
            if (StringUtils.hasText(host) && host.startsWith(spacesBucket + ".")) {
                log.warn(
                        "APP_SPACES_ENDPOINT='{}' có vẻ đang dùng bucket origin endpoint. Hãy dùng regional S3 endpoint như https://sgp1.digitaloceanspaces.com; bucket origin endpoint chỉ nên dùng cho APP_SPACES_PUBLIC_BASE_URL.",
                        sanitizeUrlForLog(endpoint)
                );
            }
        } catch (Exception ex) {
            log.warn("Không thể phân tích APP_SPACES_ENDPOINT='{}' để kiểm tra cấu hình.", sanitizeUrlForLog(endpoint));
        }
    }

    private String resolveConfiguredEndpoint() {
        if (s3Client == null) {
            return null;
        }
        return s3Client.serviceClientConfiguration() != null
                && s3Client.serviceClientConfiguration().endpointOverride().isPresent()
                ? s3Client.serviceClientConfiguration().endpointOverride().get().toString()
                : null;
    }

    private String sanitizeUrlForLog(String value) {
        return StringUtils.hasText(value) ? value.trim() : "<empty>";
    }

    private String normalizeObjectPrefix(String objectPrefix) {
        if (!StringUtils.hasText(objectPrefix)) {
            return "";
        }
        return objectPrefix.trim().replace('\\', '/').replaceAll("^/+", "").replaceAll("/+$", "");
    }

    @PreDestroy
    public void closeClient() {
        if (s3Client != null) {
            s3Client.close();
        }
    }

    public record StoredObject(byte[] bytes, String fileName) {}
}
