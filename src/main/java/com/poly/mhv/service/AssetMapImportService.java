package com.poly.mhv.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.assetmap.MapFloorCreateRequest;
import com.poly.mhv.dto.assetmap.MapFloorResponse;
import com.poly.mhv.dto.assetmapimport.AssetMapImportAnalyzeResponse;
import com.poly.mhv.dto.assetmapimport.AssetMapImportApplyResponse;
import com.poly.mhv.dto.assetmapimport.AssetMapImportDrawingResponse;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.MapFloorRepository;
import com.poly.mhv.util.UtcDateTimes;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AssetMapImportService {
    private static final Logger log = LoggerFactory.getLogger(AssetMapImportService.class);

    private static final DateTimeFormatter FALLBACK_NAME_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final AssetMapService assetMapService;
    private final MapFloorRepository mapFloorRepository;
    private final MediaStorageService mediaStorageService;
    private final MediaSecurityService mediaSecurityService;
    private final ObjectMapper objectMapper;
    private final Path sessionRootDir;

    public AssetMapImportService(
            AssetMapService assetMapService,
            MapFloorRepository mapFloorRepository,
            MediaStorageService mediaStorageService,
            MediaSecurityService mediaSecurityService,
            ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value("${app.upload-dir:uploads}") String uploadDir
    ) {
        this.assetMapService = assetMapService;
        this.mapFloorRepository = mapFloorRepository;
        this.mediaStorageService = mediaStorageService;
        this.mediaSecurityService = mediaSecurityService;
        this.objectMapper = objectMapper;
        Path uploadRootDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.sessionRootDir = uploadRootDir.resolve("asset-map-import-sessions");
    }

    public AssetMapImportAnalyzeResponse analyzeImportImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException("Vui long chon anh ban ve PNG, JPG hoac JPEG de import.");
        }
        String sourceFileName = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename().trim() : "drawing.png";
        try {
            MediaSecurityService.ValidatedMedia validatedMedia = mediaSecurityService.validateImage(
                    file.getBytes(),
                    Set.of("image/png", "image/jpeg")
            );
            String sourceFileType = resolveSourceFileType(validatedMedia.mimeType());
            log.info("[asset-map-import] analyze image start fileName={} fileType={}", sourceFileName, sourceFileType);
            Files.createDirectories(sessionRootDir);
            String sessionId = UUID.randomUUID().toString();
            Path sessionDir = sessionRootDir.resolve(sessionId);
            Files.createDirectories(sessionDir);

            String safeSourceName = "source-" + stripExtension(sanitizeFileName(sourceFileName)) + "." + validatedMedia.extension();
            Path sourceFilePath = sessionDir.resolve(safeSourceName).normalize();
            Files.write(sourceFilePath, validatedMedia.bytes(), StandardOpenOption.CREATE_NEW);

            ImportSessionData sessionData = buildManualImageSession(
                    sessionId,
                    sourceFilePath,
                    sourceFileName,
                    sourceFileType
            );
            log.info("[asset-map-import] analyze image done sessionId={} drawings={}", sessionId, sessionData.getDrawings().size());
            saveSessionData(sessionDir, sessionData);
            return mapAnalyzeResponse(sessionData);
        } catch (IOException ex) {
            throw new CustomException("Khong the luu du lieu import tam thoi.");
        }
    }

    @Transactional
    public AssetMapImportApplyResponse applyImportSession(String sessionId, List<String> drawingIds) {
        ImportSessionData sessionData = loadSessionData(sessionId);
        Set<String> selectedIds = new LinkedHashSet<>();
        if (drawingIds != null) {
            drawingIds.stream()
                    .filter(StringUtils::hasText)
                    .map(value -> value.trim())
                    .forEach(selectedIds::add);
        }
        if (selectedIds.isEmpty()) {
            throw new CustomException("Can chon it nhat mot ban ve con de tao so do.");
        }

        Set<String> reservedFloorNames = new HashSet<>();
        mapFloorRepository.findAllByOrderBySortOrderAscIdAsc().forEach(floor -> reservedFloorNames.add(normalizeKey(floor.getName())));

        List<MapFloorResponse> createdFloors = new ArrayList<>();
        Path sessionDir = sessionRootDir.resolve(sessionId.trim()).normalize();
        String persistedBackgroundUrl = persistFloorBackground(sessionData, sessionDir);
        for (ImportDrawing drawing : sessionData.getDrawings()) {
            if (!selectedIds.contains(drawing.getDrawingId())) {
                continue;
            }
            GridDimension gridDimension = resolveGridDimension(drawing);

            String floorName = ensureUniqueName(resolveDrawingTitle(drawing), reservedFloorNames, "Tang import");
            MapFloorResponse createdFloor = assetMapService.createFloor(MapFloorCreateRequest.builder()
                    .name(floorName)
                    .mode("IMAGE")
                    .gridRows(gridDimension.rows())
                    .gridCols(gridDimension.cols())
                    .canvasBackgroundColor("#FFFFFF")
                    .backgroundImageUrl(persistedBackgroundUrl)
                    .imageWidth(drawing.getPreviewWidth())
                    .imageHeight(drawing.getPreviewHeight())
                    .build());
            createdFloors.add(createdFloor);
        }

        if (createdFloors.isEmpty()) {
            throw new CustomException("Khong tim thay anh da chon de tao tang anh nen.");
        }

        deleteSession(sessionId);
        return AssetMapImportApplyResponse.builder()
                .message("Da tao tang anh nen thanh cong. Hay tu ve cac phong tren anh.")
                .createdFloorIds(createdFloors.stream().map(createdFloor -> createdFloor.getId()).toList())
                .build();
    }

    private ImportSessionData buildManualImageSession(
            String sessionId,
            Path sourceFilePath,
            String sourceFileName,
            String sourceFileType
    ) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(Files.readAllBytes(sourceFilePath)));
        if (image == null) {
            throw new CustomException("Khong the doc file anh. Hay dung PNG, JPG hoac JPEG.");
        }

        String previewUrl = "/api/media/uploads/asset-map-import-sessions/" + sessionId + "/" + sourceFilePath.getFileName();
        String drawingTitle = stripExtension(sourceFileName);
        if (!StringUtils.hasText(drawingTitle)) {
            drawingTitle = "Anh ban ve " + UtcDateTimes.now().format(FALLBACK_NAME_TIME);
        }

        ImportDrawing drawing = ImportDrawing.builder()
                .drawingId("image-root")
                .title(drawingTitle)
                .previewUrl(previewUrl)
                .previewWidth(image.getWidth())
                .previewHeight(image.getHeight())
                .bounds(new Bounds(0, 0, image.getWidth(), image.getHeight()))
                .build();

        return ImportSessionData.builder()
                .sessionId(sessionId)
                .sourceFileName(sourceFileName)
                .storedFileName(sourceFilePath.getFileName().toString())
                .sourceFileType(sourceFileType)
                .createdAt(UtcDateTimes.now().toString())
                .drawings(List.of(drawing))
                .build();
    }

    public void deleteSession(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }
        Path sessionDir = sessionRootDir.resolve(sessionId.trim()).normalize();
        if (!sessionDir.startsWith(sessionRootDir) || !Files.exists(sessionDir)) {
            return;
        }
        try (var pathStream = Files.walk(sessionDir)) {
            pathStream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // session tam co the duoc don lai o lan sau
                }
            });
        } catch (IOException ignored) {
            // bo qua cleanup best-effort
        }
    }


    private AssetMapImportAnalyzeResponse mapAnalyzeResponse(ImportSessionData sessionData) {
        return AssetMapImportAnalyzeResponse.builder()
                .sessionId(sessionData.getSessionId())
                .sourceFileName(sessionData.getSourceFileName())
                .sourceFileType(sessionData.getSourceFileType())
                .drawings(sessionData.getDrawings().stream()
                        .map(drawing -> AssetMapImportDrawingResponse.builder()
                                .drawingId(drawing.getDrawingId())
                                .title(drawing.getTitle())
                                .previewUrl(drawing.getPreviewUrl())
                                .width(drawing.getBounds() != null ? drawing.getBounds().getWidth() : null)
                                .height(drawing.getBounds() != null ? drawing.getBounds().getHeight() : null)
                                .build())
                        .toList())
                .build();
    }

    private void saveSessionData(Path sessionDir, ImportSessionData sessionData) throws IOException {
        objectMapper.writeValue(sessionDir.resolve("session.json").toFile(), sessionData);
    }

    private ImportSessionData loadSessionData(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            throw new CustomException("Khong tim thay phien import tam thoi.");
        }
        Path sessionDir = sessionRootDir.resolve(sessionId.trim()).normalize();
        if (!sessionDir.startsWith(sessionRootDir) || !Files.exists(sessionDir.resolve("session.json"))) {
            throw new CustomException("Phien import da het han hoac khong ton tai.");
        }
        try {
            return objectMapper.readValue(sessionDir.resolve("session.json").toFile(), ImportSessionData.class);
        } catch (IOException ex) {
            throw new CustomException("Khong the doc du lieu import tam thoi.");
        }
    }

    private String persistFloorBackground(ImportSessionData sessionData, Path sessionDir) {
        try {
            String storedFileName = firstNonBlank(sessionData.getStoredFileName(), "source-drawing.png");
            Path sourceFilePath = sessionDir.resolve(storedFileName).normalize();
            if (!sourceFilePath.startsWith(sessionDir) || !Files.exists(sourceFilePath)) {
                throw new CustomException("Khong tim thay anh import de tao nen so do.");
            }
            String sourceFileType = firstNonBlank(sessionData.getSourceFileType(), resolveSourceFileTypeFromPath(sourceFilePath));
            String mimeType = resolveImageMimeType(sourceFileType);
            String extension = resolveImageExtension(sourceFileType);
            return mediaStorageService.storeBytes(
                    Files.readAllBytes(sourceFilePath),
                    mimeType,
                    "asset-map/backgrounds",
                    extension
            );
        } catch (IOException ex) {
            throw new CustomException("Khong the luu anh nen cho so do import.");
        }
    }

    private String resolveSourceFileType(String mimeType) {
        String normalized = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "image/png" -> "PNG";
            case "image/jpeg" -> "JPEG";
            default -> throw new CustomException("Dinh dang anh nen so do khong hop le.");
        };
    }

    private String resolveSourceFileTypeFromPath(Path path) {
        String fileName = path == null || path.getFileName() == null ? "" : path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (fileName.endsWith(".png")) {
            return "PNG";
        }
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
            return "JPEG";
        }
        throw new CustomException("Dinh dang anh nen so do khong hop le.");
    }

    private String resolveImageMimeType(String sourceFileType) {
        String normalized = sourceFileType == null ? "" : sourceFileType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PNG" -> "image/png";
            case "JPG", "JPEG" -> "image/jpeg";
            default -> throw new CustomException("Dinh dang anh nen so do khong hop le.");
        };
    }

    private String resolveImageExtension(String sourceFileType) {
        String normalized = sourceFileType == null ? "" : sourceFileType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PNG" -> "png";
            case "JPG", "JPEG" -> "jpg";
            default -> throw new CustomException("Dinh dang anh nen so do khong hop le.");
        };
    }

    private GridDimension resolveGridDimension(ImportDrawing drawing) {
        double width = drawing.getBounds().getWidth();
        double height = drawing.getBounds().getHeight();
        int longestSideCells = 48;
        if (width >= height) {
            int cols = longestSideCells;
            int rows = clampInt((int) Math.round((height / Math.max(width, 1d)) * cols), 8, 100);
            return new GridDimension(rows, cols);
        }
        int rows = longestSideCells;
        int cols = clampInt((int) Math.round((width / Math.max(height, 1d)) * rows), 8, 100);
        return new GridDimension(rows, cols);
    }

    private String resolveDrawingTitle(ImportDrawing drawing) {
        return firstNonBlank(drawing.getTitle(), "Bản vẽ " + UtcDateTimes.now().format(FALLBACK_NAME_TIME));
    }

    private String ensureUniqueName(String requestedName, Set<String> reservedNames, String fallbackPrefix) {
        String baseName = StringUtils.hasText(requestedName) ? requestedName.trim() : fallbackPrefix;
        if (!StringUtils.hasText(baseName)) {
            baseName = fallbackPrefix + " " + UtcDateTimes.now().format(FALLBACK_NAME_TIME);
        }
        String candidate = baseName;
        int suffix = 2;
        while (!reservedNames.add(normalizeKey(candidate))) {
            candidate = baseName + " " + suffix++;
        }
        return candidate;
    }

    private String sanitizeFileName(String value) {
        String normalized = value == null ? "file" : value.trim();
        normalized = normalized.replaceAll("[^a-zA-Z0-9._-]+", "-");
        return StringUtils.hasText(normalized) ? normalized : "file";
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String firstNonBlank(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary.trim() : fallback;
    }

    private String stripExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return null;
        }
        return fileName.replaceFirst("\\.[^.]+$", "").trim();
    }

    private int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private record GridDimension(int rows, int cols) {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ImportSessionData {
        private String sessionId;
        private String sourceFileName;
        private String storedFileName;
        private String sourceFileType;
        private String createdAt;
        @Builder.Default
        private List<ImportDrawing> drawings = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ImportDrawing {
        private String drawingId;
        private String title;
        private String previewUrl;
        private Integer previewWidth;
        private Integer previewHeight;
        private Bounds bounds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Bounds {
        private double minX;
        private double minY;
        private double maxX;
        private double maxY;

        public double getWidth() {
            return Math.max(0d, maxX - minX);
        }

        public double getHeight() {
            return Math.max(0d, maxY - minY);
        }
    }
}
