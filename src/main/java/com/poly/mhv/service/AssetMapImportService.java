package com.poly.mhv.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.dto.assetmap.MapFloorResponse;
import com.poly.mhv.dto.assetmapimport.MapImportApplyResponse;
import com.poly.mhv.dto.assetmapimport.MapImportApplyRequest;
import com.poly.mhv.dto.assetmapimport.MapImportFloorResponse;
import com.poly.mhv.dto.assetmapimport.MapImportFloorSelectionRequest;
import com.poly.mhv.dto.assetmapimport.MapImportJobDetailResponse;
import com.poly.mhv.dto.assetmapimport.MapImportJobSummaryResponse;
import com.poly.mhv.dto.assetmapimport.MapImportSuggestionResponse;
import com.poly.mhv.dto.assetmapimport.MapImportFloorApplyTargetRequest;
import com.poly.mhv.dto.assetmapimport.MapImportSuggestionUpdateRequest;
import com.poly.mhv.service.CadImportEngineClient.CadEngineBoundsResult;
import com.poly.mhv.service.CadImportEngineClient.CadEngineDiscoverResponse;
import com.poly.mhv.service.CadImportEngineClient.CadEngineParsedSheetResult;
import com.poly.mhv.service.CadImportEngineClient.CadEngineParseResponse;
import com.poly.mhv.service.CadImportEngineClient.CadEngineSheetResult;
import com.poly.mhv.service.CadImportEngineClient.CadEngineSuggestionResult;
import com.poly.mhv.service.DxfProcessingService.DxfGeometryBox;
import com.poly.mhv.service.DxfProcessingService.DxfInsertMarker;
import com.poly.mhv.service.DxfProcessingService.DxfParseResult;
import com.poly.mhv.service.DxfProcessingService.DxfTextLabel;
import com.poly.mhv.service.OdaFileConverterService.OdaConversionResult;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.MapFloor;
import com.poly.mhv.entity.MapImportFloor;
import com.poly.mhv.entity.MapImportJob;
import com.poly.mhv.entity.MapImportSuggestion;
import com.poly.mhv.entity.RoomShape;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.MapFloorRepository;
import com.poly.mhv.repository.MapImportFloorRepository;
import com.poly.mhv.repository.MapImportJobRepository;
import com.poly.mhv.repository.MapImportSuggestionRepository;
import com.poly.mhv.repository.RoomShapeRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Pattern;
import lombok.Builder;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;

@Service
public class AssetMapImportService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AssetMapImportService.class);
    private static final Set<String> SUPPORTED_SOURCE_TYPES = Set.of("PDF", "DWG", "DXF");
    private static final Map<String, String> MIME_EXTENSION = Map.of(
            "application/pdf", "pdf",
            "application/acad", "dwg",
            "image/vnd.dwg", "dwg",
            "application/dxf", "dxf",
            "image/vnd.dxf", "dxf"
    );
    private static final Pattern DIMENSION_ONLY_PATTERN = Pattern.compile("^[0-9.,:/\\\\-]+$");

    private final MapImportJobRepository mapImportJobRepository;
    private final MapImportFloorRepository mapImportFloorRepository;
    private final MapImportSuggestionRepository mapImportSuggestionRepository;
    private final MapFloorRepository mapFloorRepository;
    private final LocationRepository locationRepository;
    private final RoomShapeRepository roomShapeRepository;
    private final CurrentUserProvider currentUserProvider;
    private final CadImportEngineClient cadImportEngineClient;
    private final OdaFileConverterService odaFileConverterService;
    private final DxfProcessingService dxfProcessingService;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;
    private final Path importStorageDir;
    private final HttpClient httpClient;

    public AssetMapImportService(
            MapImportJobRepository mapImportJobRepository,
            MapImportFloorRepository mapImportFloorRepository,
            MapImportSuggestionRepository mapImportSuggestionRepository,
            MapFloorRepository mapFloorRepository,
            LocationRepository locationRepository,
            RoomShapeRepository roomShapeRepository,
            CurrentUserProvider currentUserProvider,
            CadImportEngineClient cadImportEngineClient,
            OdaFileConverterService odaFileConverterService,
            DxfProcessingService dxfProcessingService,
            ObjectMapper objectMapper,
            @Value("${app.upload-dir:uploads}") String uploadDir
    ) {
        this.mapImportJobRepository = mapImportJobRepository;
        this.mapImportFloorRepository = mapImportFloorRepository;
        this.mapImportSuggestionRepository = mapImportSuggestionRepository;
        this.mapFloorRepository = mapFloorRepository;
        this.locationRepository = locationRepository;
        this.roomShapeRepository = roomShapeRepository;
        this.currentUserProvider = currentUserProvider;
        this.cadImportEngineClient = cadImportEngineClient;
        this.odaFileConverterService = odaFileConverterService;
        this.dxfProcessingService = dxfProcessingService;
        this.objectMapper = objectMapper;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.importStorageDir = this.uploadDir.resolve("asset-map-import").normalize();
        this.httpClient = HttpClient.newHttpClient();
    }

    @Transactional
    public MapImportJobSummaryResponse createJob(MultipartFile file, String requestedSourceType) {
        if (file == null || file.isEmpty()) {
            throw new CustomException("File bản vẽ không được để trống.");
        }

        long startedAt = System.nanoTime();
        String originalFileName = sanitizeFileName(file.getOriginalFilename());
        String sourceType = resolveSourceType(file, requestedSourceType, originalFileName);
        String mimeType = resolveMimeType(file, sourceType);
        String extension = resolveExtension(file, sourceType, mimeType, originalFileName);
        byte[] fileBytes = readFileBytes(file);
        long readBytesAt = System.nanoTime();
        String sourceFileUrl = storeSourceFile(fileBytes, mimeType, extension);
        long storedAt = System.nanoTime();
        PdfPreviewData pdfPreview = "PDF".equals(sourceType) ? generatePdfPreview(fileBytes) : null;
        long previewAt = System.nanoTime();
        List<ParsedPdfLabel> parsedPdfLabels = pdfPreview != null ? extractPdfLabels(fileBytes, pdfPreview) : List.of();
        long parsedPdfAt = System.nanoTime();
        // Avoid expensive heuristic text scanning for binary DWG during upload.
        // DWG will be analyzed in the next step via ODA/DXF or CAD engine if available.
        List<String> extractedCadTexts = "DXF".equals(sourceType) ? extractCadLikeTexts(fileBytes) : List.of();
        long extractedCadAt = System.nanoTime();
        AppUser currentUser = currentUserProvider.getCurrentUser();

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("phase", "PHASE_1_UPLOAD");
        metadata.put("originalContentType", normalizeOrNull(file.getContentType()));
        metadata.put("fileSizeBytes", file.getSize());
        metadata.put("storedExtension", extension);
        metadata.put("previewAvailable", pdfPreview != null && StringUtils.hasText(pdfPreview.previewFileUrl()));
        metadata.put("analysisMode", "placeholder-review");
        if (pdfPreview != null) {
            metadata.put("previewWidthPx", pdfPreview.widthPx());
            metadata.put("previewHeightPx", pdfPreview.heightPx());
            metadata.put("pageCount", pdfPreview.pageCount());
            metadata.put("parsedLabelCount", parsedPdfLabels.size());
            metadata.put("parsedLabels", parsedPdfLabels.stream().map(this::toMetadataMap).toList());
        }
        if (!extractedCadTexts.isEmpty()) {
            metadata.put("cadExtractedTexts", extractedCadTexts);
            metadata.put("cadExtractedTextCount", extractedCadTexts.size());
        }

        MapImportJob job = MapImportJob.builder()
                .sourceFileName(originalFileName)
                .sourceFileType(sourceType)
                .sourceFileUrl(sourceFileUrl)
                .status("UPLOADED")
                .previewFileUrl(pdfPreview != null ? pdfPreview.previewFileUrl() : null)
                .pageCount(pdfPreview != null ? pdfPreview.pageCount() : null)
                .detectedFloorCount(0)
                .rawMetadataJson(writeMetadata(metadata))
                .requestedBy(currentUser)
                .build();

        MapImportJob savedJob = mapImportJobRepository.save(job);
        LOGGER.info(
                "Import upload job {}: sourceType={}, fileSizeBytes={}, storageProvider={}, readMs={}, storeMs={}, previewMs={}, pdfLabelMs={}, cadTextMs={}, totalServerMs={}",
                savedJob.getId(),
                sourceType,
                file.getSize(),
                "import-local",
                elapsedMillis(startedAt, readBytesAt),
                elapsedMillis(readBytesAt, storedAt),
                elapsedMillis(storedAt, previewAt),
                elapsedMillis(previewAt, parsedPdfAt),
                elapsedMillis(parsedPdfAt, extractedCadAt),
                elapsedMillis(startedAt, extractedCadAt)
        );

        return mapJobSummary(savedJob);
    }

    @Transactional(readOnly = true)
    public List<MapImportJobSummaryResponse> getJobs() {
        return mapImportJobRepository.findAllByOrderByRequestedAtDescIdDesc().stream()
                .map(this::mapJobSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public MapImportJobDetailResponse getJobDetail(Long jobId) {
        return mapJobDetail(getJobDetailEntity(jobId));
    }

    @Transactional
    public void deleteJob(Long jobId) {
        MapImportJob job = mapImportJobRepository.findById(jobId)
                .orElseThrow(() -> new CustomException("Khong tim thay import job."));
        deleteImportArtifact(job.getSourceFileUrl());
        deleteImportArtifact(job.getPreviewFileUrl());
        deleteImportArtifact(extractMetadataString(job.getRawMetadataJson(), "effectiveDxfFileUrl"));
        mapImportJobRepository.delete(job);
        LOGGER.info("Deleted import job {} and cleaned local import artifacts.", jobId);
    }

    @Transactional
    public MapImportJobDetailResponse analyzeJob(Long jobId) {
        MapImportJob job = getJobDetailEntity(jobId);
        job.setStatus("PROCESSING");
        job.setErrorMessage(null);
        mapImportJobRepository.save(job);

        try {
            job.getFloors().clear();
            Integer previewWidthPx = extractMetadataInteger(job.getRawMetadataJson(), "previewWidthPx");
            Integer previewHeightPx = extractMetadataInteger(job.getRawMetadataJson(), "previewHeightPx");
            List<ParsedPdfLabel> parsedPdfLabels = extractParsedPdfLabels(job.getRawMetadataJson());
            DxfPreparedData dxfPreparedData = !"PDF".equals(job.getSourceFileType()) ? prepareLocalCadData(job) : null;
            List<DxfTextLabel> dxfTextLabels = dxfPreparedData != null ? dxfPreparedData.labels() : List.of();
            List<DxfGeometryBox> dxfGeometryBoxes = dxfPreparedData != null ? dxfPreparedData.geometryBoxes() : List.of();
            List<DxfInsertMarker> dxfInsertMarkers = dxfPreparedData != null ? dxfPreparedData.insertMarkers() : List.of();
            boolean hasLocalCadData = !dxfTextLabels.isEmpty() || !dxfGeometryBoxes.isEmpty() || !dxfInsertMarkers.isEmpty();
            Integer cadCanvasWidthPx = dxfPreparedData != null
                    ? Integer.valueOf(dxfPreparedData.canvasWidthPx())
                    : defaultIfNull(extractMetadataInteger(job.getRawMetadataJson(), "dxfCanvasWidthPx"), 1600);
            Integer cadCanvasHeightPx = dxfPreparedData != null
                    ? Integer.valueOf(dxfPreparedData.canvasHeightPx())
                    : defaultIfNull(extractMetadataInteger(job.getRawMetadataJson(), "dxfCanvasHeightPx"), 900);
            if (!"PDF".equals(job.getSourceFileType())) {
                LOGGER.info(
                        "CAD analyze job {}: localDxf={}, canvas={}x{}, labels={}, geometryBoxes={}, insertMarkers={}",
                        job.getId(),
                        dxfPreparedData != null,
                        cadCanvasWidthPx,
                        cadCanvasHeightPx,
                        dxfTextLabels.size(),
                        dxfGeometryBoxes.size(),
                        dxfInsertMarkers.size()
                );
            }
            List<DetectedDrawingCandidate> discoveredFloors = "PDF".equals(job.getSourceFileType())
                    ? discoverPdfDrawingCandidates(job, previewWidthPx, previewHeightPx, parsedPdfLabels)
                    : hasLocalCadData
                    ? discoverCadDrawingCandidatesFromDxfData(job, dxfTextLabels, dxfGeometryBoxes, dxfInsertMarkers, cadCanvasWidthPx, cadCanvasHeightPx)
                    : cadImportEngineClient.isEnabledFor(job.getSourceFileType())
                    ? discoverCadDrawingCandidatesFromEngine(job)
                    : discoverCadDrawingCandidates(job);
            if (discoveredFloors.isEmpty()) {
                discoveredFloors = List.of(DetectedDrawingCandidate.builder()
                        .sourceFloorKey("AUTO-1")
                        .suggestedName(buildSuggestedFloorName(job))
                        .friendlyLabel(buildSuggestedFloorName(job))
                        .drawingType("FLOOR_PLAN")
                        .pageNumber("PDF".equals(job.getSourceFileType()) ? 1 : null)
                        .sortOrder(0)
                        .widthPx(previewWidthPx != null ? previewWidthPx : 1600)
                        .heightPx(previewHeightPx != null ? previewHeightPx : 900)
                        .backgroundImageUrl(resolveBackgroundImageUrl(job))
                        .detectionConfidence(0.2d)
                        .selectedForAnalysis(true)
                        .scaleHint("Chua tach duoc nhieu ban ve con, tao mot ban tam de admin tiep tuc review.")
                        .build());
            }
            for (DetectedDrawingCandidate discoveredFloor : discoveredFloors) {
                job.getFloors().add(MapImportFloor.builder()
                        .job(job)
                        .sourceFloorKey(discoveredFloor.sourceFloorKey())
                        .suggestedName(discoveredFloor.suggestedName())
                        .friendlyLabel(discoveredFloor.friendlyLabel())
                        .drawingType(discoveredFloor.drawingType())
                        .pageNumber(discoveredFloor.pageNumber())
                        .sortOrder(discoveredFloor.sortOrder())
                        .widthPx(discoveredFloor.widthPx())
                        .heightPx(discoveredFloor.heightPx())
                        .scaleHint(discoveredFloor.scaleHint())
                        .backgroundImageUrl(discoveredFloor.backgroundImageUrl())
                        .previewBoundsJson(discoveredFloor.previewBoundsJson())
                        .detectionConfidence(discoveredFloor.detectionConfidence())
                        .selectedForAnalysis(discoveredFloor.selectedForAnalysis())
                        .parseStatus("DISCOVERED")
                        .build());
            }
            job.setDetectedFloorCount(job.getFloors().size());
            job.setStatus("REVIEW_READY");
            job.setPreviewFileUrl(resolvePreviewFileUrl(job));
            job.setRawMetadataJson(writeMetadata(mergeMetadata(job.getRawMetadataJson(), Map.of(
                    "phase", "PHASE_3_DISCOVERED",
                    "analysisMode", "child-drawing-discovery",
                    "generatedFloorCount", job.getFloors().size(),
                    "cadEngineUsed", cadImportEngineClient.isEnabledFor(job.getSourceFileType()),
                    "localCadUsed", dxfPreparedData != null
            ))));

            MapImportJob savedJob = mapImportJobRepository.save(job);
            return mapJobDetail(savedJob);
        } catch (Exception ex) {
            String analyzeErrorMessage = buildAnalyzeErrorMessage(ex);
            LOGGER.error(
                    "Failed to analyze map import job. jobId={}, sourceFileName={}, sourceFileType={}",
                    job.getId(),
                    job.getSourceFileName(),
                    job.getSourceFileType(),
                    ex
            );
            job.setStatus("FAILED");
            job.setErrorMessage(analyzeErrorMessage);
            mapImportJobRepository.save(job);
            if (ex instanceof CustomException customException) {
                throw customException;
            }
            throw new CustomException(analyzeErrorMessage);
        }
    }

    @Transactional
    public MapImportSuggestionResponse updateSuggestion(
            Long jobId,
            Long suggestionId,
            MapImportSuggestionUpdateRequest request
    ) {
        MapImportSuggestion suggestion = mapImportSuggestionRepository.findByIdAndImportFloorJobId(suggestionId, jobId)
                .orElseThrow(() -> new CustomException("Khong tim thay suggestion can cap nhat."));

        if (request == null) {
            throw new CustomException("Du lieu suggestion khong hop le.");
        }
        if (StringUtils.hasText(request.getLabelText())) {
            suggestion.setLabelText(request.getLabelText().trim());
        }
        if (StringUtils.hasText(request.getNormalizedName())) {
            suggestion.setNormalizedName(request.getNormalizedName().trim());
        }
        if (StringUtils.hasText(request.getSuggestionType())) {
            suggestion.setSuggestionType(normalizeSuggestionType(request.getSuggestionType()));
        }
        if (request.getHasAssetSuggested() != null) {
            suggestion.setHasAssetSuggested(request.getHasAssetSuggested());
        }
        if (StringUtils.hasText(request.getColorHex())) {
            suggestion.setColorHex(normalizeColorHex(request.getColorHex(), suggestion.getSuggestionType()));
        }
        if (request.getPolygonJson() != null) {
            validatePolygonJson(request.getPolygonJson());
            suggestion.setPolygonJson(StringUtils.hasText(request.getPolygonJson()) ? request.getPolygonJson().trim() : null);
        }
        if (StringUtils.hasText(request.getReviewStatus())) {
            suggestion.setReviewStatus(normalizeReviewStatus(request.getReviewStatus()));
        }
        suggestion.setNotes(StringUtils.hasText(request.getNotes()) ? request.getNotes().trim() : null);

        return mapSuggestion(mapImportSuggestionRepository.save(suggestion));
    }

    @Transactional
    public MapImportSuggestionResponse resetSuggestion(Long jobId, Long suggestionId) {
        MapImportSuggestion suggestion = mapImportSuggestionRepository.findByIdAndImportFloorJobId(suggestionId, jobId)
                .orElseThrow(() -> new CustomException("Khong tim thay suggestion can reset."));
        List<ParsedPdfLabel> parsedPdfLabels = extractParsedPdfLabels(suggestion.getImportFloor().getJob().getRawMetadataJson());
        if (parsedPdfLabels.isEmpty()) {
            throw new CustomException("Khong co du lieu parser goc de reset suggestion.");
        }

        List<MapImportSuggestion> orderedSuggestions = new ArrayList<>(
                Optional.ofNullable(suggestion.getImportFloor().getSuggestions()).orElse(List.of())
        );
        orderedSuggestions.sort((left, right) -> compareNullableLong(left.getId(), right.getId()));
        int suggestionIndex = -1;
        for (int index = 0; index < orderedSuggestions.size(); index += 1) {
            if (Long.valueOf(suggestionId).equals(orderedSuggestions.get(index).getId())) {
                suggestionIndex = index;
                break;
            }
        }
        if (suggestionIndex < 0 || suggestionIndex >= parsedPdfLabels.size()) {
            throw new CustomException("Khong tim duoc du lieu parser goc phu hop de reset suggestion.");
        }

        ParsedPdfLabel parsedPdfLabel = parsedPdfLabels.get(suggestionIndex);
        suggestion.setLabelText(parsedPdfLabel.text());
        suggestion.setNormalizedName(parsedPdfLabel.normalizedName());
        suggestion.setSuggestionType(parsedPdfLabel.suggestionType());
        suggestion.setColorHex(parsedPdfLabel.colorHex());
        suggestion.setHasAssetSuggested(parsedPdfLabel.hasAssetSuggested());
        suggestion.setPolygonJson(parsedPdfLabel.polygonJson());
        suggestion.setReviewStatus("PENDING");
        suggestion.setNotes(parsedPdfLabel.notes());

        return mapSuggestion(mapImportSuggestionRepository.save(suggestion));
    }

    @Transactional
    public MapImportFloorResponse updateFloorSelection(Long jobId, Long floorId, MapImportFloorSelectionRequest request) {
        MapImportFloor floor = mapImportFloorRepository.findByIdAndJobId(floorId, jobId)
                .orElseThrow(() -> new CustomException("Khong tim thay ban ve con can cap nhat."));
        boolean nextSelection = request == null || request.getSelectedForAnalysis() == null || request.getSelectedForAnalysis();
        floor.setSelectedForAnalysis(nextSelection);
        return mapFloor(mapImportFloorRepository.save(floor));
    }

    @Transactional
    public MapImportJobDetailResponse parseSelectedDrawings(Long jobId) {
        MapImportJob job = getJobDetailEntity(jobId);
        List<ParsedPdfLabel> parsedPdfLabels = extractParsedPdfLabels(job.getRawMetadataJson());
        List<String> cadTexts = extractCadTextsFromMetadata(job.getRawMetadataJson());
        List<DxfTextLabel> dxfTextLabels = extractDxfTextLabels(job.getRawMetadataJson());
        List<DxfGeometryBox> dxfGeometryBoxes = extractDxfGeometryBoxes(job.getRawMetadataJson());
        List<DxfInsertMarker> dxfInsertMarkers = extractDxfInsertMarkers(job.getRawMetadataJson());
        boolean hasLocalCadData = !dxfTextLabels.isEmpty() || !dxfGeometryBoxes.isEmpty() || !dxfInsertMarkers.isEmpty();
        List<MapImportFloor> selectedFloors = Optional.ofNullable(job.getFloors()).orElse(List.of()).stream()
                .filter(floor -> !Boolean.FALSE.equals(floor.getSelectedForAnalysis()))
                .toList();
        if (selectedFloors.isEmpty()) {
            throw new CustomException("Hay chon it nhat mot ban ve con de phan tich.");
        }

        int totalSuggestionCount = 0;
        if (!"PDF".equals(job.getSourceFileType()) && hasLocalCadData) {
            for (MapImportFloor floor : selectedFloors) {
                List<MapImportSuggestion> suggestions = buildSuggestionsForCadFloorFromDxfLabels(floor, dxfTextLabels, dxfGeometryBoxes);
                if (suggestions.isEmpty()) {
                    suggestions = List.of(buildFallbackSuggestion(floor, job.getSourceFileType()));
                }
                replaceFloorSuggestions(floor, suggestions);
                floor.setScaleHint(buildScaleHint(suggestions.size()));
                floor.setParseStatus("PARSED");
                totalSuggestionCount += suggestions.size();
            }
        } else if (!"PDF".equals(job.getSourceFileType()) && cadImportEngineClient.isEnabledFor(job.getSourceFileType())) {
            totalSuggestionCount = applyCadEngineParsedSuggestions(job, selectedFloors);
        } else {
            for (MapImportFloor floor : selectedFloors) {
                List<MapImportSuggestion> suggestions = "PDF".equals(job.getSourceFileType())
                        ? buildSuggestionsForDiscoveredPdfFloor(floor, parsedPdfLabels)
                        : "DWG".equalsIgnoreCase(job.getSourceFileType())
                        ? List.of()
                        : buildSuggestionsForCadFloor(floor, cadTexts);
                if (suggestions.isEmpty()) {
                    suggestions = List.of(buildFallbackSuggestion(floor, job.getSourceFileType()));
                }
                replaceFloorSuggestions(floor, suggestions);
                floor.setScaleHint(buildScaleHint(suggestions.size()));
                floor.setParseStatus("PARSED");
                totalSuggestionCount += suggestions.size();
            }
        }
        Optional.ofNullable(job.getFloors()).orElse(List.of()).stream()
                .filter(floor -> Boolean.FALSE.equals(floor.getSelectedForAnalysis()))
                .forEach(floor -> {
                    floor.getSuggestions().clear();
                    floor.setParseStatus("SKIPPED");
                });
        job.setStatus("REVIEW_READY");
        job.setRawMetadataJson(writeMetadata(mergeMetadata(job.getRawMetadataJson(), Map.of(
                "phase", "PHASE_3_PARSED_SELECTED",
                "analysisMode", "selected-drawing-review",
                "parsedFloorCount", selectedFloors.size(),
                "generatedSuggestionCount", totalSuggestionCount,
                "cadEngineUsed", cadImportEngineClient.isEnabledFor(job.getSourceFileType()),
                "localCadUsed", hasLocalCadData
        ))));
        return mapJobDetail(mapImportJobRepository.save(job));
    }

    @Transactional
    public MapImportApplyResponse applyJob(Long jobId, MapImportApplyRequest request) {
        MapImportJob job = getJobDetailEntity(jobId);
        if (!"REVIEW_READY".equalsIgnoreCase(job.getStatus())) {
            throw new CustomException("Chi co the ap dung job dang o trang thai san sang review.");
        }

        List<MapImportSuggestion> approvedSuggestions = job.getFloors().stream()
                .flatMap(floor -> Optional.ofNullable(floor.getSuggestions()).orElse(List.of()).stream())
                .filter(this::isSuggestionApprovedForApply)
                .toList();

        if (approvedSuggestions.isEmpty()) {
            throw new CustomException("Chua co suggestion nao duoc duyet de ap dung vao so do that.");
        }

        List<MapImportSuggestion> approvedSuggestionsWithGeometry = approvedSuggestions.stream()
                .filter(this::hasApplicableGeometryForApply)
                .toList();
        if (approvedSuggestionsWithGeometry.isEmpty()) {
            throw new CustomException("Chua co suggestion da duyet nao co vung hinh hoc hop le de ap dung vao so do that.");
        }

        Map<Long, MapImportFloorApplyTargetRequest> floorTargetMap = buildFloorTargetMap(request);
        Map<Long, MapFloor> appliedFloors = new LinkedHashMap<>();
        int appliedLocationCount = 0;
        int appliedShapeCount = 0;
        int skippedSuggestionCount = 0;

        Map<Integer, Set<String>> occupiedCellsByFloor = new HashMap<>();
        for (RoomShape shape : roomShapeRepository.findAllWithFloorAndLocation()) {
            occupiedCellsByFloor.computeIfAbsent(shape.getFloor().getId(), key -> new LinkedHashSet<>())
                    .addAll(readCells(shape.getCellsJson()));
        }

        for (MapImportFloor importFloor : Optional.ofNullable(job.getFloors()).orElse(List.of())) {
            List<MapImportSuggestion> floorApprovedSuggestions = Optional.ofNullable(importFloor.getSuggestions())
                    .orElse(List.of())
                    .stream()
                    .filter(this::isSuggestionApprovedForApply)
                    .filter(this::hasApplicableGeometryForApply)
                    .toList();
            if (floorApprovedSuggestions.isEmpty()) {
                continue;
            }

            MapFloor mapFloor = resolveApplyTargetFloor(importFloor, floorTargetMap.get(importFloor.getId()), appliedFloors);
            appliedFloors.put(importFloor.getId(), mapFloor);
            Set<String> occupiedCells = occupiedCellsByFloor.computeIfAbsent(mapFloor.getId(), key -> new LinkedHashSet<>());

            for (MapImportSuggestion suggestion : floorApprovedSuggestions) {
                List<String> cells = rasterizeSuggestionToCells(suggestion, mapFloor);
                if (cells.isEmpty() || cells.stream().anyMatch(occupiedCells::contains)) {
                    skippedSuggestionCount += 1;
                    continue;
                }

                Location location = createAppliedLocation(suggestion, mapFloor);
                RoomShape roomShape = RoomShape.builder()
                        .floor(mapFloor)
                        .location(location)
                        .cellsJson(writeMetadata(Map.of("cells", cells)))
                        .colorHex(normalizeColorHex(suggestion.getColorHex(), suggestion.getSuggestionType()))
                        .build();
                roomShape.setCellsJson(writeCellsJson(cells));
                roomShapeRepository.save(roomShape);
                occupiedCells.addAll(cells);
                suggestion.setLinkedLocationId(location.getId());
                appliedLocationCount += 1;
                appliedShapeCount += 1;
            }
        }

        approvedSuggestions.forEach(suggestion -> {
            if (suggestion.getLinkedLocationId() != null) {
                suggestion.setReviewStatus("APPROVED");
            }
        });
        mapImportSuggestionRepository.saveAll(approvedSuggestions);

        job.setStatus("APPLIED");
        mapImportJobRepository.save(job);

        return MapImportApplyResponse.builder()
                .jobId(job.getId())
                .jobStatus(job.getStatus())
                .appliedFloorCount(appliedFloors.size())
                .appliedLocationCount(appliedLocationCount)
                .appliedShapeCount(appliedShapeCount)
                .skippedSuggestionCount(skippedSuggestionCount)
                .appliedFloorNames(appliedFloors.values().stream().map(MapFloor::getName).toList())
                .message("Da ap dung suggestion da duyet vao so do that.")
                .build();
    }

    private MapImportJob getJobDetailEntity(Long jobId) {
        if (jobId == null) {
            throw new CustomException("Khong tim thay job import ban ve.");
        }
        MapImportJob job = mapImportJobRepository.findWithDetailsById(jobId)
                .orElseThrow(() -> new CustomException("Khong tim thay job import ban ve."));
        // Load suggestions in a second query to avoid Hibernate MultipleBagFetchException
        // when a job contains both floors (List) and floor suggestions (List).
        mapImportFloorRepository.findByJobIdOrderBySortOrderAscIdAsc(jobId);
        Optional.ofNullable(job.getFloors()).orElse(List.of()).forEach(floor -> floor.getSuggestions().size());
        return job;
    }

    private String buildAnalyzeErrorMessage(Exception ex) {
        if (ex instanceof CustomException && StringUtils.hasText(ex.getMessage())) {
            return ex.getMessage();
        }
        String rootMessage = ex != null ? extractRootCauseMessage(ex) : null;
        if (StringUtils.hasText(rootMessage)) {
            return "Khong the khoi tao phan tich ban ve: " + rootMessage;
        }
        return "Khong the khoi tao phan tich ban ve.";
    }

    private Integer defaultIfNull(Integer value, int fallback) {
        return value != null ? value : fallback;
    }

    private Double defaultIfNull(Double value, double fallback) {
        return value != null ? value : fallback;
    }

    private String extractRootCauseMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current != null && current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        if (current == null) {
            return null;
        }
        String message = current.getMessage();
        return StringUtils.hasText(message) ? message.trim() : current.getClass().getSimpleName();
    }

    private byte[] readFileBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception ex) {
            throw new CustomException("Khong the doc file ban ve.");
        }
    }

    private String storeSourceFile(byte[] fileBytes, String mimeType, String extension) {
        try {
            return storeImportArtifact(fileBytes, "source", extension);
        } catch (Exception ex) {
            throw new CustomException("Khong the luu file ban ve.");
        }
    }

    private String storeImportArtifact(byte[] bytes, String category, String extension) {
        try {
            Path categoryDir = importStorageDir.resolve(category).normalize();
            Files.createDirectories(categoryDir);
            String safeExtension = StringUtils.hasText(extension) ? extension.trim().toLowerCase(Locale.ROOT) : "bin";
            Path targetPath = categoryDir.resolve(UUID.randomUUID() + "." + safeExtension).normalize();
            Files.write(targetPath, bytes);
            return toImportArtifactUrl(targetPath);
        } catch (Exception ex) {
            throw new CustomException("Khong the luu tep import tam thoi.");
        }
    }

    private String toImportArtifactUrl(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(uploadDir)) {
            throw new CustomException("Duong dan tep import khong hop le.");
        }
        String relativePath = uploadDir.relativize(normalized).toString().replace('\\', '/');
        return "/uploads/" + relativePath;
    }

    private void deleteImportArtifact(String storedUrl) {
        if (!StringUtils.hasText(storedUrl) || !storedUrl.startsWith("/uploads/")) {
            return;
        }
        try {
            Path artifactPath = uploadDir.resolve(storedUrl.substring("/uploads/".length())).normalize();
            if (!artifactPath.startsWith(importStorageDir)) {
                return;
            }
            Files.deleteIfExists(artifactPath);
        } catch (Exception ex) {
            LOGGER.warn("Khong the xoa tep import tam thoi: {}", storedUrl);
        }
    }

    private long elapsedMillis(long startNano, long endNano) {
        return Math.max(0L, Math.round((endNano - startNano) / 1_000_000.0d));
    }

    private DxfPreparedData prepareLocalCadData(MapImportJob job) {
        if (job == null || "PDF".equalsIgnoreCase(job.getSourceFileType())) {
            return null;
        }
        long startedAt = System.nanoTime();
        List<DxfTextLabel> cachedLabels = extractDxfTextLabels(job.getRawMetadataJson());
        List<DxfGeometryBox> cachedGeometryBoxes = extractDxfGeometryBoxes(job.getRawMetadataJson());
        List<DxfInsertMarker> cachedInsertMarkers = extractDxfInsertMarkers(job.getRawMetadataJson());
        Map<String, Integer> cachedEntityStats = extractDxfEntityStats(job.getRawMetadataJson());
        Integer cachedWidth = extractMetadataInteger(job.getRawMetadataJson(), "dxfCanvasWidthPx");
        Integer cachedHeight = extractMetadataInteger(job.getRawMetadataJson(), "dxfCanvasHeightPx");
        String existingDxfUrl = extractMetadataString(job.getRawMetadataJson(), "effectiveDxfFileUrl");
        Integer cachedParseVersion = extractMetadataInteger(job.getRawMetadataJson(), "dxfParseVersion");
        if (StringUtils.hasText(existingDxfUrl)
                && cachedParseVersion != null
                && cachedParseVersion >= 6
                && (!cachedLabels.isEmpty() || !cachedGeometryBoxes.isEmpty() || !cachedInsertMarkers.isEmpty())) {
            LOGGER.info(
                    "CAD local data job {}: cacheHit=true, labels={}, geometryBoxes={}, insertMarkers={}, entityStats={}, topEntities={}, topLayers={}, topBlocks={}, totalMs={}",
                    job.getId(),
                    cachedLabels.size(),
                    cachedGeometryBoxes.size(),
                    cachedInsertMarkers.size(),
                    summarizeEntityStats(cachedEntityStats),
                    summarizeTopEntityTypes(cachedEntityStats),
                    summarizeTopLayers(cachedGeometryBoxes, cachedLabels),
                    summarizeTopBlocks(cachedInsertMarkers),
                    elapsedMillis(startedAt, System.nanoTime())
            );
            return new DxfPreparedData(
                    existingDxfUrl,
                    cachedWidth != null ? cachedWidth : 1600,
                    cachedHeight != null ? cachedHeight : 900,
                    cachedLabels,
                    cachedGeometryBoxes,
                    cachedInsertMarkers
            );
        }
        if ("DWG".equalsIgnoreCase(job.getSourceFileType()) && !odaFileConverterService.isEnabledFor(job.getSourceFileType())) {
            LOGGER.warn("CAD local data job {}: ODA disabled for DWG, skip local DWG->DXF pipeline.", job.getId());
            return null;
        }
        try {
            Path workspaceDir = Files.createTempDirectory("asset-map-import-");
            Path sourcePath = materializeStoredFile(job.getSourceFileUrl(), job.getSourceFileType().toLowerCase(Locale.ROOT), workspaceDir.resolve("source"));
            long materializedAt = System.nanoTime();
            Path dxfPath = sourcePath;
            String effectiveDxfUrl = job.getSourceFileUrl();
            String conversionLog = null;
            if ("DWG".equalsIgnoreCase(job.getSourceFileType())) {
                OdaConversionResult conversionResult = odaFileConverterService.convertDwgToDxf(sourcePath, workspaceDir);
                dxfPath = conversionResult.dxfPath();
                conversionLog = conversionResult.commandOutput();
                effectiveDxfUrl = storeImportArtifact(Files.readAllBytes(dxfPath), "converted", "dxf");
            }
            long convertedAt = System.nanoTime();
            DxfParseResult parseResult = dxfProcessingService.parse(dxfPath);
            long parsedAt = System.nanoTime();
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("effectiveDxfFileUrl", effectiveDxfUrl);
            metadata.put("dxfParseVersion", 6);
            metadata.put("dxfCanvasWidthPx", parseResult.canvasWidthPx());
            metadata.put("dxfCanvasHeightPx", parseResult.canvasHeightPx());
            metadata.put("dxfTextLabelCount", parseResult.labels().size());
            metadata.put("dxfTextLabels", parseResult.labels().stream().map(this::toMetadataMap).toList());
            metadata.put("dxfGeometryBoxes", parseResult.geometryBoxes().stream().map(this::toMetadataMap).toList());
            metadata.put("dxfInsertMarkers", parseResult.insertMarkers().stream().map(this::toMetadataMap).toList());
            metadata.put("dxfEntityStats", parseResult.entityStats());
            metadata.put("cadExtractedTexts", parseResult.labels().stream().map(DxfTextLabel::text).distinct().limit(200).toList());
            if (StringUtils.hasText(conversionLog)) {
                metadata.put("odaConversionLog", conversionLog);
            }
            job.setRawMetadataJson(writeMetadata(mergeMetadata(job.getRawMetadataJson(), metadata)));
            LOGGER.info(
                    "CAD local data job {}: cacheHit=false, sourceType={}, materializeMs={}, convertAndStoreMs={}, parseMs={}, labels={}, geometryBoxes={}, insertMarkers={}, entityStats={}, topEntities={}, topLayers={}, topBlocks={}, effectiveDxfUrl={}",
                    job.getId(),
                    job.getSourceFileType(),
                    elapsedMillis(startedAt, materializedAt),
                    elapsedMillis(materializedAt, convertedAt),
                    elapsedMillis(convertedAt, parsedAt),
                    parseResult.labels().size(),
                    parseResult.geometryBoxes().size(),
                    parseResult.insertMarkers().size(),
                    summarizeEntityStats(parseResult.entityStats()),
                    summarizeTopEntityTypes(parseResult.entityStats()),
                    summarizeTopLayers(parseResult.geometryBoxes(), parseResult.labels()),
                    summarizeTopBlocks(parseResult.insertMarkers()),
                    effectiveDxfUrl
            );
            if (parseResult.geometryBoxes().isEmpty()) {
                LOGGER.warn(
                        "CAD local data job {}: DXF parse produced zero geometry boxes. labels={}, insertMarkers={}, sourceType={}, topEntities={}, topLayers={}, topBlocks={}",
                        job.getId(),
                        parseResult.labels().size(),
                        parseResult.insertMarkers().size(),
                        job.getSourceFileType(),
                        summarizeTopEntityTypes(parseResult.entityStats()),
                        summarizeTopLayers(parseResult.geometryBoxes(), parseResult.labels()),
                        summarizeTopBlocks(parseResult.insertMarkers())
                );
            }
            return new DxfPreparedData(
                    effectiveDxfUrl,
                    parseResult.canvasWidthPx(),
                    parseResult.canvasHeightPx(),
                    parseResult.labels(),
                    parseResult.geometryBoxes(),
                    parseResult.insertMarkers()
            );
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            return null;
        }
    }

    private Path materializeStoredFile(String storedUrl, String extension, Path targetPath) {
        try {
            Path normalizedTarget = ensureExtension(targetPath, extension);
            Files.createDirectories(normalizedTarget.getParent());
            if (StringUtils.hasText(storedUrl) && storedUrl.startsWith("/uploads/")) {
                Path localPath = uploadDir.resolve(storedUrl.substring("/uploads/".length())).normalize();
                if (Files.exists(localPath)) {
                    Files.copy(localPath, normalizedTarget, StandardCopyOption.REPLACE_EXISTING);
                    return normalizedTarget;
                }
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(storedUrl))
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CustomException("Khong the tai file CAD nguon tu storage.");
            }
            Files.write(normalizedTarget, response.body());
            return normalizedTarget;
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Khong the chuan bi file CAD nguon.");
        }
    }

    private Path ensureExtension(Path path, String extension) {
        String fileName = path.getFileName().toString();
        if (fileName.toLowerCase(Locale.ROOT).endsWith("." + extension.toLowerCase(Locale.ROOT))) {
            return path;
        }
        return path.resolveSibling(fileName + "." + extension.toLowerCase(Locale.ROOT));
    }

    private PdfPreviewData generatePdfPreview(byte[] fileBytes) {
        try (PDDocument document = Loader.loadPDF(fileBytes)) {
            int pageCount = document.getNumberOfPages();
            if (pageCount <= 0) {
                throw new CustomException("File PDF khong co trang nao de preview.");
            }

            PDFRenderer renderer = new PDFRenderer(document);
            BufferedImage previewImage = renderer.renderImageWithDPI(0, 144);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ImageIO.write(previewImage, "png", outputStream);
            String previewFileUrl = storeImportArtifact(
                    outputStream.toByteArray(),
                    "previews",
                    "png"
            );
            return new PdfPreviewData(previewFileUrl, pageCount, previewImage.getWidth(), previewImage.getHeight());
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Khong the tao preview cho file PDF.");
        }
    }

    private List<ParsedPdfLabel> extractPdfLabels(byte[] fileBytes, PdfPreviewData previewData) {
        try (PDDocument document = Loader.loadPDF(fileBytes)) {
            if (document.getNumberOfPages() <= 0) {
                return List.of();
            }
            PDPage page = document.getPage(0);
            float pageWidth = page.getMediaBox().getWidth();
            float pageHeight = page.getMediaBox().getHeight();
            PositionedPdfLabelStripper stripper = new PositionedPdfLabelStripper(
                    previewData.widthPx(),
                    previewData.heightPx(),
                    pageWidth,
                    pageHeight
            );
            stripper.setSortByPosition(true);
            stripper.setStartPage(1);
            stripper.setEndPage(1);
            stripper.getText(document);
            return normalizeParsedPdfLabels(stripper.getRawLabels());
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String resolveSourceType(MultipartFile file, String requestedSourceType, String originalFileName) {
        String normalizedRequestedType = normalizeOrNull(requestedSourceType);
        if (StringUtils.hasText(normalizedRequestedType)) {
            String sourceType = normalizedRequestedType.toUpperCase(Locale.ROOT);
            if (SUPPORTED_SOURCE_TYPES.contains(sourceType)) {
                return sourceType;
            }
            throw new CustomException("Loai file ban ve chua duoc ho tro.");
        }

        String extension = extractExtension(originalFileName);
        if ("pdf".equals(extension)) {
            return "PDF";
        }
        if ("dwg".equals(extension)) {
            return "DWG";
        }
        if ("dxf".equals(extension)) {
            return "DXF";
        }

        String contentType = normalizeOrNull(file.getContentType());
        if ("application/pdf".equals(contentType)) {
            return "PDF";
        }
        throw new CustomException("He thong hien chi ho tro file PDF, DWG hoac DXF.");
    }

    private String resolveMimeType(MultipartFile file, String sourceType) {
        String contentType = normalizeOrNull(file.getContentType());
        if (StringUtils.hasText(contentType)) {
            return contentType;
        }
        return switch (sourceType) {
            case "PDF" -> "application/pdf";
            case "DWG" -> "application/acad";
            case "DXF" -> "application/dxf";
            default -> "application/octet-stream";
        };
    }

    private String resolveExtension(MultipartFile file, String sourceType, String mimeType, String originalFileName) {
        String fromName = extractExtension(originalFileName);
        if (StringUtils.hasText(fromName)) {
            return fromName;
        }
        String fromMime = MIME_EXTENSION.get(normalizeOrNull(mimeType));
        if (StringUtils.hasText(fromMime)) {
            return fromMime;
        }
        return sourceType.toLowerCase(Locale.ROOT);
    }

    private String resolvePreviewFileUrl(MapImportJob job) {
        return job.getPreviewFileUrl();
    }

    private String resolveBackgroundImageUrl(MapImportJob job) {
        return job.getPreviewFileUrl();
    }

    private String buildSuggestedFloorName(MapImportJob job) {
        String baseName = stripExtension(job.getSourceFileName());
        if (!StringUtils.hasText(baseName)) {
            return "Tang 1";
        }
        return "Tang tu ban ve - " + baseName;
    }

    private boolean isSuggestionApprovedForApply(MapImportSuggestion suggestion) {
        String reviewStatus = normalizeReviewStatus(suggestion.getReviewStatus());
        return "APPROVED".equals(reviewStatus) || "EDITED".equals(reviewStatus);
    }

    private boolean hasApplicableGeometryForApply(MapImportSuggestion suggestion) {
        return suggestion != null && !parseRectBounds(suggestion.getPolygonJson()).isEmpty();
    }

    private Map<Long, MapImportFloorApplyTargetRequest> buildFloorTargetMap(MapImportApplyRequest request) {
        Map<Long, MapImportFloorApplyTargetRequest> floorTargetMap = new HashMap<>();
        if (request == null || request.getFloorTargets() == null) {
            return floorTargetMap;
        }
        for (MapImportFloorApplyTargetRequest targetRequest : request.getFloorTargets()) {
            if (targetRequest == null || targetRequest.getImportFloorId() == null) {
                continue;
            }
            floorTargetMap.put(targetRequest.getImportFloorId(), targetRequest);
        }
        return floorTargetMap;
    }

    private MapFloor resolveApplyTargetFloor(
            MapImportFloor importFloor,
            MapImportFloorApplyTargetRequest targetRequest,
            Map<Long, MapFloor> appliedFloors
    ) {
        if (targetRequest != null && Boolean.FALSE.equals(targetRequest.getCreateNewFloor()) && targetRequest.getTargetFloorId() != null) {
            return mapFloorRepository.findById(targetRequest.getTargetFloorId())
                    .orElseThrow(() -> new CustomException("Khong tim thay tang dich de ap dung."));
        }
        return createAppliedFloor(importFloor);
    }

    private MapFloor createAppliedFloor(MapImportFloor importFloor) {
        String baseName = StringUtils.hasText(importFloor.getSuggestedName())
                ? importFloor.getSuggestedName().trim()
                : "Tang import";
        String floorName = baseName;
        int suffix = 2;
        while (mapFloorRepository.existsByNameIgnoreCase(floorName)) {
            floorName = baseName + " (" + suffix + ")";
            suffix += 1;
        }
        int gridRows = Math.max(12, estimateGridSize(importFloor.getHeightPx()));
        int gridCols = Math.max(20, estimateGridSize(importFloor.getWidthPx()));
        return mapFloorRepository.save(MapFloor.builder()
                .name(floorName)
                .sortOrder(resolveNextFloorSortOrder())
                .gridRows(gridRows)
                .gridCols(gridCols)
                .canvasBackgroundColor("#FFFFFF")
                .build());
    }

    private int resolveNextFloorSortOrder() {
        List<MapFloor> existingFloors = mapFloorRepository.findAllByOrderBySortOrderAscIdAsc();
        return existingFloors.stream()
                .map(MapFloor::getSortOrder)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private int estimateGridSize(Integer pixelSize) {
        if (pixelSize == null || pixelSize <= 0) {
            return 20;
        }
        return Math.max(12, Math.min(100, (int) Math.ceil(pixelSize / 32.0)));
    }

    private Location createAppliedLocation(MapImportSuggestion suggestion, MapFloor mapFloor) {
        String baseRoomName = StringUtils.hasText(suggestion.getNormalizedName())
                ? suggestion.getNormalizedName().trim()
                : StringUtils.hasText(suggestion.getLabelText()) ? suggestion.getLabelText().trim() : "Khu vuc import";
        String roomName = baseRoomName;
        int suffix = 2;
        while (locationRepository.existsByRoomNameIgnoreCase(roomName)) {
            roomName = baseRoomName + " (" + suffix + ")";
            suffix += 1;
        }
        return locationRepository.save(Location.builder()
                .roomName(roomName)
                .hasAsset(suggestion.getHasAssetSuggested() != null ? suggestion.getHasAssetSuggested() : true)
                .floor(mapFloor)
                .build());
    }

    private List<String> rasterizeSuggestionToCells(MapImportSuggestion suggestion, MapFloor mapFloor) {
        Map<String, Integer> bounds = parseRectBounds(suggestion.getPolygonJson());
        if (bounds.isEmpty()) {
            return List.of();
        }
        int minCol = Math.max(0, (int) Math.floor(bounds.getOrDefault("x", 0) / 32.0));
        int minRow = Math.max(0, (int) Math.floor(bounds.getOrDefault("y", 0) / 32.0));
        int maxCol = Math.max(minCol, (int) Math.ceil((bounds.getOrDefault("x", 0) + bounds.getOrDefault("width", 12)) / 32.0) - 1);
        int maxRow = Math.max(minRow, (int) Math.ceil((bounds.getOrDefault("y", 0) + bounds.getOrDefault("height", 12)) / 32.0) - 1);

        maxCol = Math.min(maxCol, Math.max(0, mapFloor.getGridCols() - 1));
        maxRow = Math.min(maxRow, Math.max(0, mapFloor.getGridRows() - 1));

        List<String> cells = new ArrayList<>();
        for (int row = minRow; row <= maxRow; row += 1) {
            for (int col = minCol; col <= maxCol; col += 1) {
                cells.add(row + ":" + col);
            }
        }
        return cells;
    }

    private Map<String, Integer> parseRectBounds(String polygonJson) {
        if (!StringUtils.hasText(polygonJson)) {
            return Map.of();
        }
        try {
            Map<String, Object> raw = objectMapper.readValue(polygonJson, new TypeReference<Map<String, Object>>() {
            });
            Map<String, Integer> bounds = new HashMap<>();
            bounds.put("x", asInteger(raw.get("x")) != null ? asInteger(raw.get("x")) : 0);
            bounds.put("y", asInteger(raw.get("y")) != null ? asInteger(raw.get("y")) : 0);
            bounds.put("width", asInteger(raw.get("width")) != null ? asInteger(raw.get("width")) : 12);
            bounds.put("height", asInteger(raw.get("height")) != null ? asInteger(raw.get("height")) : 12);
            return bounds;
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private void validatePolygonJson(String polygonJson) {
        if (!StringUtils.hasText(polygonJson)) {
            return;
        }
        if (parseRectBounds(polygonJson).isEmpty()) {
            throw new CustomException("Bounding box suggestion khong hop le.");
        }
    }

    private String writeCellsJson(List<String> cells) {
        try {
            return objectMapper.writeValueAsString(cells);
        } catch (Exception ex) {
            throw new CustomException("Khong the luu cells cho room shape.");
        }
    }

    private List<String> readCells(String cellsJson) {
        if (!StringUtils.hasText(cellsJson)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(cellsJson, new TypeReference<List<String>>() {
            });
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String normalizeSuggestionType(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Loai khu vuc suggestion khong hop le.");
        }
        return switch (normalized) {
            case "ROOM", "CORRIDOR", "STAIR", "ELEVATOR", "YARD", "ROAD", "GATE", "UNKNOWN" -> normalized;
            default -> throw new CustomException("Loai khu vuc suggestion khong hop le.");
        };
    }

    private String normalizeReviewStatus(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "PENDING";
        return switch (normalized) {
            case "PENDING", "APPROVED", "REJECTED", "EDITED" -> normalized;
            default -> "PENDING";
        };
    }

    private String normalizeColorHex(String colorHex, String suggestionType) {
        String fallback = resolveSuggestionColor(StringUtils.hasText(suggestionType) ? suggestionType : "UNKNOWN");
        if (!StringUtils.hasText(colorHex)) {
            return fallback;
        }
        String normalized = colorHex.trim().toUpperCase(Locale.ROOT);
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }
        if (!normalized.matches("^#[0-9A-F]{6}$")) {
            return fallback;
        }
        return normalized;
    }

    private String buildScaleHint(int suggestionCount) {
        if (suggestionCount <= 0) {
            return "Pha 1C - chua tim thay label phong hop le";
        }
        return "Pha 1C - da trich " + suggestionCount + " label goi y tu text PDF";
    }

    private String sanitizeFileName(String originalFileName) {
        String normalized = normalizeOrNull(originalFileName);
        if (!StringUtils.hasText(normalized)) {
            return "ban-ve";
        }
        return normalized.replace('\\', '/').replaceAll("^.+/", "");
    }

    private String stripExtension(String fileName) {
        String normalized = normalizeOrNull(fileName);
        if (!StringUtils.hasText(normalized)) {
            return null;
        }
        int lastDot = normalized.lastIndexOf('.');
        return lastDot > 0 ? normalized.substring(0, lastDot) : normalized;
    }

    private String extractExtension(String fileName) {
        String normalized = normalizeOrNull(fileName);
        if (!StringUtils.hasText(normalized)) {
            return null;
        }
        int lastDot = normalized.lastIndexOf('.');
        if (lastDot < 0 || lastDot == normalized.length() - 1) {
            return null;
        }
        return normalized.substring(lastDot + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeOrNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String writeMetadata(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception ex) {
            throw new CustomException("Khong the luu metadata import ban ve.");
        }
    }

    private Map<String, Object> mergeMetadata(String currentRawMetadataJson, Map<String, Object> additions) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (StringUtils.hasText(currentRawMetadataJson)) {
            try {
                metadata.putAll(objectMapper.readValue(currentRawMetadataJson, new TypeReference<Map<String, Object>>() {
                }));
            } catch (Exception ex) {
                metadata.put("rawMetadataParseError", true);
            }
        }
        metadata.putAll(additions);
        return metadata;
    }

    private Integer extractMetadataInteger(String rawMetadataJson, String key) {
        if (!StringUtils.hasText(rawMetadataJson) || !StringUtils.hasText(key)) {
            return null;
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object value = metadata.get(key);
            if (value instanceof Number number) {
                return number.intValue();
            }
            if (value instanceof String text && StringUtils.hasText(text)) {
                return Integer.parseInt(text.trim());
            }
        } catch (Exception ex) {
            return null;
        }
        return null;
    }

    private String extractMetadataString(String rawMetadataJson, String key) {
        if (!StringUtils.hasText(rawMetadataJson) || !StringUtils.hasText(key)) {
            return null;
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            return asString(metadata.get(key));
        } catch (Exception ex) {
            return null;
        }
    }

    private List<ParsedPdfLabel> extractParsedPdfLabels(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return List.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawLabels = metadata.get("parsedLabels");
            if (!(rawLabels instanceof List<?> labels)) {
                return List.of();
            }
            List<ParsedPdfLabel> results = new ArrayList<>();
            for (Object item : labels) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                String text = asString(map.get("text"));
                String normalizedName = asString(map.get("normalizedName"));
                String suggestionType = asString(map.get("suggestionType"));
                String colorHex = asString(map.get("colorHex"));
                String polygonJson = asString(map.get("polygonJson"));
                String notes = asString(map.get("notes"));
                Boolean hasAssetSuggested = asBoolean(map.get("hasAssetSuggested"));
                Double confidenceScore = asDouble(map.get("confidenceScore"));
                Integer x = asInteger(map.get("x"));
                Integer y = asInteger(map.get("y"));
                Integer width = asInteger(map.get("width"));
                Integer height = asInteger(map.get("height"));
                if (!StringUtils.hasText(text)) {
                    continue;
                }
                results.add(new ParsedPdfLabel(
                        text,
                        normalizedName,
                        suggestionType != null ? suggestionType : "UNKNOWN",
                        x != null ? x : 0,
                        y != null ? y : 0,
                        width != null ? width : 0,
                        height != null ? height : 0,
                        colorHex,
                        hasAssetSuggested,
                        confidenceScore != null ? confidenceScore : 0.4d,
                        polygonJson,
                        notes
                ));
            }
            return results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<DxfTextLabel> extractDxfTextLabels(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return List.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawLabels = metadata.get("dxfTextLabels");
            if (!(rawLabels instanceof List<?> items)) {
                return List.of();
            }
            List<DxfTextLabel> results = new ArrayList<>();
            for (Object item : items) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                String text = asString(map.get("text"));
                Integer x = asInteger(map.get("x"));
                Integer y = asInteger(map.get("y"));
                Double rawX = asDouble(map.get("rawX"));
                Double rawY = asDouble(map.get("rawY"));
                if (!StringUtils.hasText(text) || x == null || y == null) {
                    continue;
                }
                results.add(new DxfTextLabel(
                        text,
                        asString(map.get("entityType")),
                        asString(map.get("layer")),
                        asString(map.get("layoutName")),
                        rawX != null ? rawX : 0d,
                        rawY != null ? rawY : 0d,
                        x,
                        y
                ));
            }
            return results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<DxfGeometryBox> extractDxfGeometryBoxes(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return List.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawBoxes = metadata.get("dxfGeometryBoxes");
            if (!(rawBoxes instanceof List<?> items)) {
                return List.of();
            }
            List<DxfGeometryBox> results = new ArrayList<>();
            for (Object item : items) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                Integer id = asInteger(map.get("id"));
                Integer x = asInteger(map.get("x"));
                Integer y = asInteger(map.get("y"));
                Integer width = asInteger(map.get("width"));
                Integer height = asInteger(map.get("height"));
                if (id == null || x == null || y == null || width == null || height == null) {
                    continue;
                }
                results.add(new DxfGeometryBox(
                        id,
                        asString(map.get("entityType")),
                        asString(map.get("layer")),
                        asString(map.get("layoutName")),
                        defaultIfNull(asDouble(map.get("rawMinX")), 0d),
                        defaultIfNull(asDouble(map.get("rawMinY")), 0d),
                        defaultIfNull(asDouble(map.get("rawMaxX")), 0d),
                        defaultIfNull(asDouble(map.get("rawMaxY")), 0d),
                        x,
                        y,
                        width,
                        height
                ));
            }
            return results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<DxfInsertMarker> extractDxfInsertMarkers(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return List.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawMarkers = metadata.get("dxfInsertMarkers");
            if (!(rawMarkers instanceof List<?> items)) {
                return List.of();
            }
            List<DxfInsertMarker> results = new ArrayList<>();
            for (Object item : items) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                Integer id = asInteger(map.get("id"));
                Integer x = asInteger(map.get("x"));
                Integer y = asInteger(map.get("y"));
                if (id == null || x == null || y == null) {
                    continue;
                }
                results.add(new DxfInsertMarker(
                        id,
                        asString(map.get("blockName")),
                        asString(map.get("effectiveName")),
                        asString(map.get("referenceKind")),
                        asString(map.get("titleHint")),
                        asString(map.get("layer")),
                        asString(map.get("layoutName")),
                        defaultIfNull(asDouble(map.get("rawX")), 0d),
                        defaultIfNull(asDouble(map.get("rawY")), 0d),
                        defaultIfNull(asDouble(map.get("scaleX")), 1d),
                        defaultIfNull(asDouble(map.get("scaleY")), 1d),
                        defaultIfNull(asDouble(map.get("rotationDegrees")), 0d),
                        x,
                        y
                ));
            }
            return results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Map<String, Integer> extractDxfEntityStats(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return Map.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawStats = metadata.get("dxfEntityStats");
            if (!(rawStats instanceof Map<?, ?> map)) {
                return Map.of();
            }
            Map<String, Integer> results = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = asString(entry.getKey());
                Integer value = asInteger(entry.getValue());
                if (StringUtils.hasText(key) && value != null) {
                    results.put(key, value);
                }
            }
            return results;
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private List<String> extractCadTextsFromMetadata(String rawMetadataJson) {
        if (!StringUtils.hasText(rawMetadataJson)) {
            return List.of();
        }
        try {
            Map<String, Object> metadata = objectMapper.readValue(rawMetadataJson, new TypeReference<Map<String, Object>>() {
            });
            Object rawTexts = metadata.get("cadExtractedTexts");
            if (!(rawTexts instanceof List<?> items)) {
                return List.of();
            }
            List<String> results = new ArrayList<>();
            for (Object item : items) {
                String text = asString(item);
                if (StringUtils.hasText(text)) {
                    results.add(text.trim());
                }
            }
            return results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<String> extractCadLikeTexts(byte[] fileBytes) {
        if (fileBytes == null || fileBytes.length == 0) {
            return List.of();
        }
        String decoded = new String(fileBytes, StandardCharsets.ISO_8859_1);
        java.util.regex.Matcher matcher = Pattern.compile("[A-Za-z0-9_À-ỹ/().,:\\-\\s]{4,120}").matcher(decoded);
        Set<String> deduplicated = new LinkedHashSet<>();
        while (matcher.find()) {
            String candidate = normalizePdfLabelText(matcher.group());
            if (!StringUtils.hasText(candidate)) {
                continue;
            }
            String folded = foldToAscii(candidate).toLowerCase(Locale.ROOT);
            if (folded.length() < 4 || folded.startsWith("ac10") || folded.startsWith("ansi_")) {
                continue;
            }
            if (!folded.matches(".*[a-z0-9].*")) {
                continue;
            }
            deduplicated.add(candidate);
            if (deduplicated.size() >= 600) {
                break;
            }
        }
        return deduplicated.stream().toList();
    }

    private List<DetectedDrawingCandidate> discoverPdfDrawingCandidates(
            MapImportJob job,
            Integer previewWidthPx,
            Integer previewHeightPx,
            List<ParsedPdfLabel> parsedPdfLabels
    ) {
        if (parsedPdfLabels == null || parsedPdfLabels.isEmpty()) {
            return List.of();
        }
        List<PdfLabelCluster> clusters = clusterPdfLabels(parsedPdfLabels, previewWidthPx, previewHeightPx);
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < clusters.size(); index += 1) {
            PdfLabelCluster cluster = clusters.get(index);
            String friendlyLabel = "Ban ve con " + (index + 1);
            String suggestedName = "Tang tu ban ve - " + stripExtension(job.getSourceFileName()) + " - " + (index + 1);
            String previewBoundsJson = buildRectanglePolygonJson(cluster.minX(), cluster.minY(), cluster.width(), cluster.height());
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("PDF-" + (index + 1))
                    .suggestedName(suggestedName)
                    .friendlyLabel(friendlyLabel)
                    .drawingType("FLOOR_PLAN")
                    .pageNumber(1)
                    .sortOrder(index)
                    .widthPx(previewWidthPx != null ? previewWidthPx : cluster.pageWidth())
                    .heightPx(previewHeightPx != null ? previewHeightPx : cluster.pageHeight())
                    .backgroundImageUrl(resolveBackgroundImageUrl(job))
                    .previewBoundsJson(previewBoundsJson)
                    .detectionConfidence(cluster.confidence())
                    .selectedForAnalysis(index < 6)
                    .scaleHint("Cum nhan tu dong tu PDF theo nhom label gan nhau.")
                    .build());
        }
        return candidates;
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidates(MapImportJob job) {
        List<String> extractedTexts = extractCadTextsFromMetadata(job.getRawMetadataJson());
        List<String> titleCandidates = extractedTexts.stream()
                .filter(this::isLikelyDrawingTitle)
                .limit(20)
                .toList();
        if (titleCandidates.isEmpty()) {
            return List.of(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("CAD-1")
                    .suggestedName(buildSuggestedFloorName(job))
                    .friendlyLabel("Ban ve tu file " + job.getSourceFileType())
                    .drawingType("UNKNOWN")
                    .sortOrder(0)
                    .widthPx(1600)
                    .heightPx(900)
                    .detectionConfidence(0.2d)
                    .selectedForAnalysis(true)
                    .scaleHint("Khong tim thay tieu de ro rang trong file CAD, tao mot ban tam de admin tu chon huong review.")
                    .build());
        }
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < titleCandidates.size(); index += 1) {
            String title = titleCandidates.get(index);
            String drawingType = classifyDrawingType(title);
            String friendlyLabel = buildFriendlyDrawingLabel(title, index);
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("CAD-" + (index + 1))
                    .suggestedName(friendlyLabel)
                    .friendlyLabel(friendlyLabel)
                    .drawingType(drawingType)
                    .sortOrder(index)
                    .widthPx(1600)
                    .heightPx(900)
                    .detectionConfidence(estimateDrawingCandidateConfidence(title, drawingType))
                    .selectedForAnalysis(isPrimaryDrawingType(drawingType))
                    .scaleHint("Nhan dien tu chuoi text trich trong file " + job.getSourceFileType() + ".")
                    .build());
        }
        return candidates;
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidatesFromEngine(MapImportJob job) {
        CadEngineDiscoverResponse response = cadImportEngineClient.discoverDrawings(job);
        List<CadEngineSheetResult> sheets = response != null && response.sheets() != null ? response.sheets() : List.of();
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < sheets.size(); index += 1) {
            CadEngineSheetResult sheet = sheets.get(index);
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey(StringUtils.hasText(sheet.sheetKey()) ? sheet.sheetKey() : "CAD-" + (index + 1))
                    .suggestedName(buildFriendlyDrawingLabel(sheet.title(), index))
                    .friendlyLabel(buildFriendlyDrawingLabel(sheet.title(), index))
                    .drawingType(StringUtils.hasText(sheet.drawingType()) ? sheet.drawingType() : "UNKNOWN")
                    .pageNumber(sheet.pageNumber())
                    .sortOrder(sheet.sortOrder() != null ? sheet.sortOrder() : index)
                    .widthPx(sheet.widthPx() != null ? sheet.widthPx() : 1600)
                    .heightPx(sheet.heightPx() != null ? sheet.heightPx() : 900)
                    .backgroundImageUrl(sheet.previewImageUrl())
                    .previewBoundsJson(toPolygonJson(sheet.previewBounds()))
                    .detectionConfidence(sheet.confidence() != null ? sheet.confidence() : 0.82d)
                    .selectedForAnalysis(sheet.selectedByDefault() != null ? sheet.selectedByDefault() : isPrimaryDrawingType(classifyDrawingType(sheet.title())))
                    .scaleHint(StringUtils.hasText(sheet.notes()) ? sheet.notes() : "Da nhan dien bang CAD engine.")
                    .build());
        }
        return candidates;
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidatesFromDxfData(
            MapImportJob job,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes,
            List<DxfInsertMarker> insertMarkers,
            Integer canvasWidthPx,
            Integer canvasHeightPx
    ) {
        List<DetectedDrawingCandidate> geometryCandidates = discoverCadDrawingCandidatesFromDxfGeometry(
                job,
                labels,
                geometryBoxes,
                insertMarkers,
                canvasWidthPx,
                canvasHeightPx
        );
        if (!geometryCandidates.isEmpty()) {
            LOGGER.info(
                    "CAD detect job {}: branch=geometry, labels={}, geometryBoxes={}, insertMarkers={}, candidates={}",
                    job.getId(),
                    labels.size(),
                    geometryBoxes.size(),
                    insertMarkers.size(),
                    summarizeCadCandidates(geometryCandidates)
            );
            return geometryCandidates;
        }
        List<DetectedDrawingCandidate> layoutCandidates = discoverCadDrawingCandidatesFromDxfLayouts(labels, insertMarkers, canvasWidthPx, canvasHeightPx);
        if (!layoutCandidates.isEmpty()) {
            LOGGER.info(
                    "CAD detect job {}: branch=layout, labels={}, insertMarkers={}, candidates={}",
                    job.getId(),
                    labels.size(),
                    insertMarkers.size(),
                    summarizeCadCandidates(layoutCandidates)
            );
            return layoutCandidates;
        }
        LOGGER.info(
                "CAD detect job {}: branch=title-text-fallback, labels={}, geometryBoxes={}, insertMarkers={}",
                job.getId(),
                labels.size(),
                geometryBoxes.size(),
                insertMarkers.size()
        );
        return discoverCadDrawingCandidatesFromDxfLabels(job, labels, canvasWidthPx, canvasHeightPx);
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidatesFromDxfGeometry(
            MapImportJob job,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes,
            List<DxfInsertMarker> insertMarkers,
            Integer canvasWidthPx,
            Integer canvasHeightPx
    ) {
        int canvasWidth = canvasWidthPx != null ? canvasWidthPx : 1600;
        int canvasHeight = canvasHeightPx != null ? canvasHeightPx : 900;
        List<DxfFrameAnalysis> analyses = new ArrayList<>();
        for (DxfGeometryBox box : geometryBoxes) {
            if (!isLikelyCadFrameGeometry(box, canvasWidth, canvasHeight)) {
                continue;
            }
            List<DxfTextLabel> insideLabels = labels.stream()
                    .filter(label -> geometryContainsLabel(box, label, 6))
                    .toList();
            List<DxfInsertMarker> insideInsertMarkers = insertMarkers.stream()
                    .filter(marker -> geometryContainsInsert(box, marker, 12))
                    .toList();
            long roomLabelCount = insideLabels.stream().filter(label -> isLikelyCadRoomLabel(label.text())).count();
            List<DxfTextLabel> titleLabels = insideLabels.stream()
                    .filter(label -> isLikelyDrawingTitle(label.text()))
                    .sorted(Comparator.comparingInt(DxfTextLabel::y).thenComparingInt(DxfTextLabel::x))
                    .toList();
            long titleBlockMarkerCount = insideInsertMarkers.stream().filter(this::isLikelyTitleBlockInsert).count();
            if (insideLabels.size() < 2 && titleLabels.isEmpty() && roomLabelCount == 0 && titleBlockMarkerCount == 0) {
                continue;
            }
            String title = chooseBestFrameTitle(titleLabels, insideLabels, insideInsertMarkers, box, job);
            String drawingType = StringUtils.hasText(title) ? classifyDrawingType(title) : inferDrawingTypeFromLabels(insideLabels);
            double score = estimateFrameScore(box, insideLabels.size(), roomLabelCount, titleLabels.size(), titleBlockMarkerCount, canvasWidth, canvasHeight);
            analyses.add(new DxfFrameAnalysis(box, title, drawingType, insideLabels.size(), roomLabelCount, titleBlockMarkerCount, score));
        }
        analyses.sort(Comparator.comparingDouble(DxfFrameAnalysis::score).reversed()
                .thenComparingInt(item -> item.box().width() * item.box().height()).reversed());
        List<DxfFrameAnalysis> selectedAnalyses = new ArrayList<>();
        for (DxfFrameAnalysis analysis : analyses) {
            boolean covered = selectedAnalyses.stream().anyMatch(existing -> isFrameSubstantiallyCovered(analysis.box(), existing.box()));
            if (!covered) {
                selectedAnalyses.add(analysis);
            }
            if (selectedAnalyses.size() >= 12) {
                break;
            }
        }
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < selectedAnalyses.size(); index += 1) {
            DxfFrameAnalysis analysis = selectedAnalyses.get(index);
            DxfGeometryBox box = analysis.box();
            String friendlyLabel = StringUtils.hasText(analysis.title())
                    ? buildFriendlyDrawingLabel(analysis.title(), index)
                    : buildFriendlyDrawingLabel("Ban ve tu file " + job.getSourceFileType(), index);
            String drawingType = StringUtils.hasText(analysis.drawingType()) ? analysis.drawingType() : "UNKNOWN";
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("DXF_FRAME:" + box.id())
                    .suggestedName(friendlyLabel)
                    .friendlyLabel(friendlyLabel)
                    .drawingType(drawingType)
                    .sortOrder(index)
                    .widthPx(canvasWidth)
                    .heightPx(canvasHeight)
                    .previewBoundsJson(buildRectanglePolygonJson(box.x(), box.y(), box.width(), box.height()))
                    .detectionConfidence(Math.max(0.35d, Math.min(0.96d, analysis.score())))
                    .selectedForAnalysis(isPrimaryDrawingType(drawingType) || analysis.roomLabelCount() > 0)
                    .scaleHint(buildFrameScaleHint(box, analysis))
                    .build());
        }
        return candidates;
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidatesFromDxfLayouts(
            List<DxfTextLabel> labels,
            List<DxfInsertMarker> insertMarkers,
            Integer canvasWidthPx,
            Integer canvasHeightPx
    ) {
        Map<String, List<DxfTextLabel>> byLayout = new LinkedHashMap<>();
        for (DxfTextLabel label : labels) {
            String layoutName = normalizeCadLayoutName(label.layoutName());
            if (!StringUtils.hasText(layoutName)) {
                continue;
            }
            byLayout.computeIfAbsent(layoutName, key -> new ArrayList<>()).add(label);
        }
        if (byLayout.isEmpty()) {
            return List.of();
        }
        int canvasWidth = canvasWidthPx != null ? canvasWidthPx : 1600;
        int canvasHeight = canvasHeightPx != null ? canvasHeightPx : 900;
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        int sortOrder = 0;
        for (Map.Entry<String, List<DxfTextLabel>> entry : byLayout.entrySet()) {
            List<DxfTextLabel> layoutLabels = entry.getValue();
            if (layoutLabels.isEmpty()) {
                continue;
            }
            int minX = layoutLabels.stream().mapToInt(DxfTextLabel::x).min().orElse(60);
            int maxX = layoutLabels.stream().mapToInt(DxfTextLabel::x).max().orElse(minX + 320);
            int minY = layoutLabels.stream().mapToInt(DxfTextLabel::y).min().orElse(60);
            int maxY = layoutLabels.stream().mapToInt(DxfTextLabel::y).max().orElse(minY + 220);
            int paddingX = 180;
            int paddingY = 140;
            int x = Math.max(0, minX - paddingX);
            int y = Math.max(0, minY - paddingY);
            int width = Math.min(canvasWidth - x, Math.max(320, (maxX - minX) + (paddingX * 2)));
            int height = Math.min(canvasHeight - y, Math.max(220, (maxY - minY) + (paddingY * 2)));
            String title = layoutLabels.stream()
                    .filter(label -> isLikelyDrawingTitle(label.text()))
                    .map(DxfTextLabel::text)
                    .findFirst()
                    .orElseGet(() -> insertMarkers.stream()
                            .filter(marker -> entry.getKey().equals(normalizeCadLayoutName(marker.layoutName())))
                            .filter(this::isLikelyTitleBlockInsert)
                            .map(marker -> StringUtils.hasText(marker.titleHint())
                                    ? marker.titleHint()
                                    : humanizeCadBlockName(StringUtils.hasText(marker.effectiveName()) ? marker.effectiveName() : marker.blockName()))
                            .findFirst()
                            .orElse(entry.getKey()));
            String drawingType = classifyDrawingType(title);
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("DXF_LAYOUT:" + entry.getKey())
                    .suggestedName(buildFriendlyDrawingLabel(title, sortOrder))
                    .friendlyLabel(buildFriendlyDrawingLabel(title, sortOrder))
                    .drawingType(drawingType)
                    .sortOrder(sortOrder)
                    .widthPx(canvasWidth)
                    .heightPx(canvasHeight)
                    .previewBoundsJson(buildRectanglePolygonJson(x, y, width, height))
                    .detectionConfidence(isPrimaryDrawingType(drawingType) ? 0.72d : 0.58d)
                    .selectedForAnalysis(isPrimaryDrawingType(drawingType))
                    .scaleHint("Nhan dien theo layout DXF `" + entry.getKey() + "` khi file khong co nhieu sheet ro rang.")
                    .build());
            sortOrder += 1;
        }
        return candidates;
    }

    private List<DetectedDrawingCandidate> discoverCadDrawingCandidatesFromDxfLabels(
            MapImportJob job,
            List<DxfTextLabel> labels,
            Integer canvasWidthPx,
            Integer canvasHeightPx
    ) {
        List<DxfTextLabel> titleLabels = labels.stream()
                .filter(label -> isLikelyDrawingTitle(label.text()))
                .sorted(Comparator.comparingInt(DxfTextLabel::y).thenComparingInt(DxfTextLabel::x))
                .limit(20)
                .toList();
        if (titleLabels.isEmpty()) {
            return discoverCadDrawingCandidates(job);
        }
        int width = canvasWidthPx != null ? canvasWidthPx : 1600;
        int height = canvasHeightPx != null ? canvasHeightPx : 900;
        List<DetectedDrawingCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < titleLabels.size(); index += 1) {
            DxfTextLabel label = titleLabels.get(index);
            String drawingType = classifyDrawingType(label.text());
            String friendlyLabel = buildFriendlyDrawingLabel(label.text(), index);
            int boundsX = Math.max(0, label.x() - 240);
            int boundsY = Math.max(0, label.y() - 220);
            int boundsWidth = Math.min(560, width - boundsX);
            int boundsHeight = Math.min(360, height - boundsY);
            candidates.add(DetectedDrawingCandidate.builder()
                    .sourceFloorKey("DXF-" + (index + 1))
                    .suggestedName(friendlyLabel)
                    .friendlyLabel(friendlyLabel)
                    .drawingType(drawingType)
                    .sortOrder(index)
                    .widthPx(width)
                    .heightPx(height)
                    .previewBoundsJson(buildRectanglePolygonJson(boundsX, boundsY, boundsWidth, boundsHeight))
                    .detectionConfidence(estimateDrawingCandidateConfidence(label.text(), drawingType))
                    .selectedForAnalysis(isPrimaryDrawingType(drawingType))
                    .scaleHint("Nhan dien tu tieu de DXF tai x=" + label.x() + ", y=" + label.y())
                    .build());
        }
        return candidates;
    }

    private int applyCadEngineParsedSuggestions(MapImportJob job, List<MapImportFloor> selectedFloors) {
        CadEngineParseResponse response = cadImportEngineClient.parseSelectedDrawings(job, selectedFloors);
        List<CadEngineParsedSheetResult> sheetResults = response != null && response.sheets() != null ? response.sheets() : List.of();
        Map<String, CadEngineParsedSheetResult> bySheetKey = new HashMap<>();
        for (CadEngineParsedSheetResult sheetResult : sheetResults) {
            if (StringUtils.hasText(sheetResult.sheetKey())) {
                bySheetKey.put(sheetResult.sheetKey(), sheetResult);
            }
        }
        int totalSuggestionCount = 0;
        for (MapImportFloor floor : selectedFloors) {
            CadEngineParsedSheetResult sheetResult = bySheetKey.get(floor.getSourceFloorKey());
            List<MapImportSuggestion> suggestions = new ArrayList<>();
            if (sheetResult != null && sheetResult.suggestions() != null) {
                for (CadEngineSuggestionResult suggestionResult : sheetResult.suggestions()) {
                    String suggestionType = StringUtils.hasText(suggestionResult.suggestionType())
                            ? normalizeSuggestionType(suggestionResult.suggestionType())
                            : classifySuggestionType(suggestionResult.labelText());
                    suggestions.add(MapImportSuggestion.builder()
                            .importFloor(floor)
                            .suggestionType(suggestionType)
                            .labelText(normalizePdfLabelText(suggestionResult.labelText()))
                            .normalizedName(buildNormalizedSuggestionName(
                                    StringUtils.hasText(suggestionResult.normalizedName())
                                            ? suggestionResult.normalizedName()
                                            : suggestionResult.labelText()
                            ))
                            .polygonJson(toPolygonJson(suggestionResult.bounds()))
                            .colorHex(normalizeColorHex(suggestionResult.colorHex(), suggestionType))
                            .hasAssetSuggested(suggestionResult.hasAssetSuggested() != null
                                    ? suggestionResult.hasAssetSuggested()
                                    : resolveHasAssetSuggestion(suggestionType))
                            .confidenceScore(suggestionResult.confidenceScore() != null ? suggestionResult.confidenceScore() : 0.84d)
                            .sourceMethod(StringUtils.hasText(suggestionResult.sourceMethod()) ? suggestionResult.sourceMethod() : "CAD_ENGINE")
                            .reviewStatus("PENDING")
                            .notes(StringUtils.hasText(suggestionResult.notes())
                                    ? suggestionResult.notes()
                                    : "Suggestion tra ve tu CAD engine.")
                            .build());
                }
            }
            if (suggestions.isEmpty()) {
                suggestions.add(buildFallbackSuggestion(floor, job.getSourceFileType()));
            }
            replaceFloorSuggestions(floor, suggestions);
            floor.setScaleHint(buildScaleHint(suggestions.size()));
            floor.setParseStatus("PARSED");
            totalSuggestionCount += suggestions.size();
        }
        return totalSuggestionCount;
    }

    private void replaceFloorSuggestions(MapImportFloor floor, List<MapImportSuggestion> nextSuggestions) {
        List<MapImportSuggestion> managedSuggestions = floor.getSuggestions();
        managedSuggestions.clear();
        if (nextSuggestions == null || nextSuggestions.isEmpty()) {
            return;
        }
        for (MapImportSuggestion suggestion : nextSuggestions) {
            if (suggestion != null) {
                suggestion.setImportFloor(floor);
                managedSuggestions.add(suggestion);
            }
        }
    }

    private List<MapImportSuggestion> buildSuggestionsForDiscoveredPdfFloor(
            MapImportFloor floor,
            List<ParsedPdfLabel> parsedPdfLabels
    ) {
        Map<String, Integer> bounds = parseRectBounds(floor.getPreviewBoundsJson());
        if (bounds.isEmpty()) {
            return buildSuggestionsFromPdfLabels(floor, parsedPdfLabels);
        }
        int minX = bounds.getOrDefault("x", 0);
        int minY = bounds.getOrDefault("y", 0);
        int maxX = minX + bounds.getOrDefault("width", 0);
        int maxY = minY + bounds.getOrDefault("height", 0);
        List<ParsedPdfLabel> filtered = parsedPdfLabels.stream()
                .filter(label -> label.x() >= minX && label.x() <= maxX && label.y() >= minY && label.y() <= maxY)
                .toList();
        return buildSuggestionsFromPdfLabels(floor, filtered);
    }

    private List<MapImportSuggestion> buildSuggestionsForCadFloor(MapImportFloor floor, List<String> cadTexts) {
        List<String> roomTexts = cadTexts.stream()
                .filter(this::isLikelyCadRoomLabel)
                .limit(18)
                .toList();
        List<MapImportSuggestion> suggestions = new ArrayList<>();
        for (int index = 0; index < roomTexts.size(); index += 1) {
            String roomText = roomTexts.get(index);
            String suggestionType = classifySuggestionType(roomText);
            int column = index % 3;
            int row = index / 3;
            String polygonJson = buildRectanglePolygonJson(60 + column * 220, 60 + row * 120, 180, 84);
            suggestions.add(MapImportSuggestion.builder()
                    .importFloor(floor)
                    .suggestionType(suggestionType)
                    .labelText(roomText)
                    .normalizedName(buildNormalizedSuggestionName(roomText))
                    .polygonJson(polygonJson)
                    .colorHex(resolveSuggestionColor(suggestionType))
                    .hasAssetSuggested(resolveHasAssetSuggestion(suggestionType))
                    .confidenceScore(0.38d)
                    .sourceMethod("TEXT_ONLY")
                    .reviewStatus("PENDING")
                    .notes("Suggestion tao tu text trich trong file CAD. Vi tri hien la placeholder de admin review lai.")
                    .build());
        }
        return suggestions;
    }

    private List<MapImportSuggestion> buildSuggestionsForCadFloorFromDxfLabels(
            MapImportFloor floor,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes
    ) {
        Map<String, Integer> bounds = parseRectBounds(floor.getPreviewBoundsJson());
        int minX = bounds.getOrDefault("x", Integer.MIN_VALUE);
        int minY = bounds.getOrDefault("y", Integer.MIN_VALUE);
        int maxX = bounds.isEmpty() ? Integer.MAX_VALUE : minX + bounds.getOrDefault("width", 0);
        int maxY = bounds.isEmpty() ? Integer.MAX_VALUE : minY + bounds.getOrDefault("height", 0);
        Integer activeFrameId = extractDxfFrameId(floor.getSourceFloorKey());
        String activeLayoutName = extractDxfLayoutKey(floor.getSourceFloorKey());
        DxfGeometryBox activeFrame = activeFrameId != null ? findDxfGeometryBoxById(geometryBoxes, activeFrameId) : null;
        if (activeFrame != null) {
            activeLayoutName = normalizeCadLayoutName(activeFrame.layoutName());
            minX = activeFrame.x();
            minY = activeFrame.y();
            maxX = activeFrame.x() + activeFrame.width();
            maxY = activeFrame.y() + activeFrame.height();
        }
        final String frameLayoutName = activeLayoutName;
        final int filterMinX = minX;
        final int filterMinY = minY;
        final int filterMaxX = maxX;
        final int filterMaxY = maxY;
        List<DxfTextLabel> roomLabels = labels.stream()
                .filter(label -> label.x() >= filterMinX && label.x() <= filterMaxX && label.y() >= filterMinY && label.y() <= filterMaxY)
                .filter(label -> frameLayoutName == null || frameLayoutName.equals(normalizeCadLayoutName(label.layoutName())))
                .filter(label -> !isIgnorableCadLayer(label.layer()))
                .filter(label -> isLikelyCadRoomLabel(label.text()))
                .limit(30)
                .toList();
        List<MapImportSuggestion> suggestions = new ArrayList<>();
        Set<String> deduplicationKeys = new LinkedHashSet<>();
        int matchedGeometryCount = 0;
        for (DxfTextLabel label : roomLabels) {
            String normalizedText = normalizePdfLabelText(label.text());
            String suggestionType = classifySuggestionType(normalizedText);
            DxfGeometryBox matchedGeometry = findBestGeometryBoxForLabel(label, geometryBoxes, activeFrame, frameLayoutName);
            if (matchedGeometry != null) {
                matchedGeometryCount += 1;
            }
            int width = matchedGeometry != null ? matchedGeometry.width() : Math.max(72, Math.min(220, normalizedText.length() * 12));
            int height = matchedGeometry != null ? matchedGeometry.height() : 56;
            int x = matchedGeometry != null ? matchedGeometry.x() : Math.max(0, label.x() - (width / 2));
            int y = matchedGeometry != null ? matchedGeometry.y() : Math.max(0, label.y() - (height / 2));
            String deduplicationKey = buildNormalizedSuggestionName(normalizedText) + "@" + Math.round(label.x() / 24.0) + ":" + Math.round(label.y() / 24.0);
            if (!deduplicationKeys.add(deduplicationKey)) {
                continue;
            }
            suggestions.add(MapImportSuggestion.builder()
                    .importFloor(floor)
                    .suggestionType(suggestionType)
                    .labelText(normalizedText)
                    .normalizedName(buildNormalizedSuggestionName(normalizedText))
                    .polygonJson(buildRectanglePolygonJson(x, y, width, height))
                    .colorHex(resolveSuggestionColor(suggestionType))
                    .hasAssetSuggested(resolveHasAssetSuggestion(suggestionType))
                    .confidenceScore(matchedGeometry != null ? 0.84d : 0.72d)
                    .sourceMethod(matchedGeometry != null ? "DXF_GEOMETRY" : "DXF_TEXT")
                    .reviewStatus("PENDING")
                    .notes(matchedGeometry != null
                            ? "Suggestion gan voi hinh hoc DXF tai layer `" + defaultText(matchedGeometry.layer(), "unknown") + "`."
                            : "Suggestion tao tu text DXF tai x=" + label.x() + ", y=" + label.y())
                    .build());
        }
        if (suggestions.isEmpty()) {
            suggestions.addAll(buildSuggestionsForCadFloorFromGeometry(
                    floor,
                    labels,
                    geometryBoxes,
                    activeFrame,
                    frameLayoutName
            ));
        }
        LOGGER.info(
                "CAD parse floor {} (job {}): sourceFloorKey={}, layout={}, frame={}, roomLabels={}, matchedGeometry={}, suggestions={}",
                floor.getId(),
                floor.getJob() != null ? floor.getJob().getId() : null,
                floor.getSourceFloorKey(),
                frameLayoutName,
                activeFrame != null ? activeFrame.id() : null,
                roomLabels.size(),
                matchedGeometryCount,
                suggestions.size()
        );
        return suggestions;
    }

    private List<MapImportSuggestion> buildSuggestionsForCadFloorFromGeometry(
            MapImportFloor floor,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes,
            DxfGeometryBox activeFrame,
            String activeLayoutName
    ) {
        if (geometryBoxes == null || geometryBoxes.isEmpty()) {
            return List.of();
        }
        double activeFrameArea = activeFrame != null
                ? (double) activeFrame.width() * activeFrame.height()
                : Math.max(1d, (double) defaultIfNull(floor.getWidthPx(), 1600) * defaultIfNull(floor.getHeightPx(), 900));
        List<DxfGeometryBox> candidates = geometryBoxes.stream()
                .filter(box -> box != null)
                .filter(box -> activeFrame == null || isGeometryInsideFrame(box, activeFrame, 8))
                .filter(box -> activeLayoutName == null || activeLayoutName.equals(normalizeCadLayoutName(box.layoutName())))
                .filter(box -> activeFrame == null || box.id() != activeFrame.id())
                .filter(box -> box.width() >= 32 && box.height() >= 24)
                .filter(box -> box.width() <= 720 && box.height() <= 520)
                .filter(box -> ((double) box.width() * box.height()) <= activeFrameArea * 0.68d)
                .filter(box -> ((double) box.width() * box.height()) >= 900d)
                .filter(box -> !isIgnorableCadLayer(box.layer()) || "HATCH".equalsIgnoreCase(box.entityType()))
                .sorted(Comparator.comparingInt(DxfGeometryBox::y).thenComparingInt(DxfGeometryBox::x))
                .toList();
        List<DxfGeometryBox> selected = new ArrayList<>();
        for (DxfGeometryBox candidate : candidates) {
            boolean overlapped = selected.stream().anyMatch(existing -> isGeometrySubstantiallyCovered(candidate, existing));
            if (!overlapped) {
                selected.add(candidate);
            }
            if (selected.size() >= 24) {
                break;
            }
        }
        List<MapImportSuggestion> suggestions = new ArrayList<>();
        for (int index = 0; index < selected.size(); index += 1) {
            DxfGeometryBox box = selected.get(index);
            String inferredLabel = chooseBestGeometryLabel(box, labels);
            String fallbackText = StringUtils.hasText(inferredLabel)
                    ? inferredLabel
                    : buildGeometryFallbackName(inferGeometrySuggestionType(box), index + 1);
            String suggestionType = classifySuggestionType(fallbackText);
            suggestions.add(MapImportSuggestion.builder()
                    .importFloor(floor)
                    .suggestionType(suggestionType)
                    .labelText(fallbackText)
                    .normalizedName(buildNormalizedSuggestionName(fallbackText))
                    .polygonJson(buildRectanglePolygonJson(box.x(), box.y(), box.width(), box.height()))
                    .colorHex(resolveSuggestionColor(suggestionType))
                    .hasAssetSuggested(resolveHasAssetSuggestion(suggestionType))
                    .confidenceScore(StringUtils.hasText(inferredLabel) ? 0.64d : 0.46d)
                    .sourceMethod(StringUtils.hasText(inferredLabel) ? "DXF_GEOMETRY_INFERRED" : "DXF_GEOMETRY_ONLY")
                    .reviewStatus("PENDING")
                    .notes(StringUtils.hasText(inferredLabel)
                            ? "Suggestion suy ra tu hinh hoc DXF va text nam trong vung."
                            : "Suggestion tao tu hinh hoc DXF khi file CAD khong co room label ro rang.")
                    .build());
        }
        return suggestions;
    }

    private boolean isGeometryInsideFrame(DxfGeometryBox candidate, DxfGeometryBox frame, int padding) {
        if (candidate == null || frame == null) {
            return false;
        }
        return candidate.x() >= frame.x() - padding
                && candidate.y() >= frame.y() - padding
                && candidate.x() + candidate.width() <= frame.x() + frame.width() + padding
                && candidate.y() + candidate.height() <= frame.y() + frame.height() + padding;
    }

    private boolean isGeometrySubstantiallyCovered(DxfGeometryBox candidate, DxfGeometryBox existing) {
        if (candidate == null || existing == null) {
            return false;
        }
        int intersectionLeft = Math.max(candidate.x(), existing.x());
        int intersectionTop = Math.max(candidate.y(), existing.y());
        int intersectionRight = Math.min(candidate.x() + candidate.width(), existing.x() + existing.width());
        int intersectionBottom = Math.min(candidate.y() + candidate.height(), existing.y() + existing.height());
        int intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
        int intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
        double candidateArea = Math.max(1d, (double) candidate.width() * candidate.height());
        double intersectionArea = (double) intersectionWidth * intersectionHeight;
        return (intersectionArea / candidateArea) >= 0.82d;
    }

    private String chooseBestGeometryLabel(DxfGeometryBox box, List<DxfTextLabel> labels) {
        if (box == null || labels == null || labels.isEmpty()) {
            return null;
        }
        return labels.stream()
                .filter(label -> geometryContainsLabel(box, label, 4))
                .map(DxfTextLabel::text)
                .map(this::normalizePdfLabelText)
                .filter(StringUtils::hasText)
                .filter(text -> !isLikelyDrawingTitle(text))
                .filter(text -> !looksLikeMojibakeCadText(text, foldToAscii(text).toLowerCase(Locale.ROOT)))
                .sorted(Comparator
                        .comparing((String text) -> !isLikelyCadRoomLabel(text))
                        .thenComparingInt(String::length))
                .findFirst()
                .orElse(null);
    }

    private String inferGeometrySuggestionType(DxfGeometryBox box) {
        if (box == null) {
            return "ROOM";
        }
        String source = defaultText(box.layer(), box.entityType());
        return classifySuggestionType(source);
    }

    private String buildGeometryFallbackName(String suggestionType, int ordinal) {
        return switch (suggestionType) {
            case "CORRIDOR" -> "Hanh lang CAD " + ordinal;
            case "STAIR" -> "Cau thang CAD " + ordinal;
            case "ELEVATOR" -> "Thang may CAD " + ordinal;
            case "YARD" -> "San CAD " + ordinal;
            case "ROAD" -> "Duong CAD " + ordinal;
            case "GATE" -> "Cong CAD " + ordinal;
            default -> "Khu vuc CAD " + ordinal;
        };
    }

    private String summarizeCadCandidates(List<DetectedDrawingCandidate> candidates) {
        return candidates.stream()
                .limit(5)
                .map(candidate -> candidate.sourceFloorKey() + ":" + defaultText(candidate.friendlyLabel(), "?")
                        + "@" + String.format(Locale.ROOT, "%.2f", candidate.detectionConfidence() != null ? candidate.detectionConfidence() : 0d))
                .collect(Collectors.joining(", "));
    }

    private boolean isLikelyCadFrameGeometry(DxfGeometryBox box, int canvasWidth, int canvasHeight) {
        if (box == null) {
            return false;
        }
        if (box.width() < Math.max(260, canvasWidth / 6) || box.height() < Math.max(180, canvasHeight / 6)) {
            return false;
        }
        double aspectRatio = box.height() == 0 ? 0d : (double) box.width() / (double) box.height();
        if (aspectRatio < 0.35d || aspectRatio > 4.5d) {
            return false;
        }
        if (isIgnorableCadLayer(box.layer()) && !isPreferredCadFrameLayer(box.layer())) {
            return false;
        }
        return true;
    }

    private boolean geometryContainsLabel(DxfGeometryBox box, DxfTextLabel label, int padding) {
        if (box == null || label == null) {
            return false;
        }
        return label.x() >= box.x() - padding
                && label.x() <= box.x() + box.width() + padding
                && label.y() >= box.y() - padding
                && label.y() <= box.y() + box.height() + padding;
    }

    private boolean geometryContainsInsert(DxfGeometryBox box, DxfInsertMarker marker, int padding) {
        if (box == null || marker == null) {
            return false;
        }
        return marker.x() >= box.x() - padding
                && marker.x() <= box.x() + box.width() + padding
                && marker.y() >= box.y() - padding
                && marker.y() <= box.y() + box.height() + padding;
    }

    private String chooseBestFrameTitle(
            List<DxfTextLabel> titleLabels,
            List<DxfTextLabel> insideLabels,
            List<DxfInsertMarker> insideInsertMarkers,
            DxfGeometryBox box,
            MapImportJob job
    ) {
        if (titleLabels != null && !titleLabels.isEmpty()) {
            return titleLabels.stream()
                    .map(DxfTextLabel::text)
                    .filter(StringUtils::hasText)
                    .findFirst()
                    .orElse(null);
        }
        if (StringUtils.hasText(normalizeCadLayoutName(box.layoutName()))) {
            return box.layoutName();
        }
        if (insideInsertMarkers != null) {
            Optional<String> titleBlockName = insideInsertMarkers.stream()
                    .filter(this::isLikelyTitleBlockInsert)
                    .map(marker -> StringUtils.hasText(marker.titleHint())
                            ? marker.titleHint()
                            : humanizeCadBlockName(StringUtils.hasText(marker.effectiveName()) ? marker.effectiveName() : marker.blockName()))
                    .filter(StringUtils::hasText)
                    .findFirst();
            if (titleBlockName.isPresent()) {
                return titleBlockName.get();
            }
        }
        return insideLabels.stream()
                .map(DxfTextLabel::text)
                .filter(this::isLikelyCadRoomLabel)
                .findFirst()
                .orElse(buildSuggestedFloorName(job));
    }

    private String inferDrawingTypeFromLabels(List<DxfTextLabel> labels) {
        return labels.stream()
                .map(DxfTextLabel::text)
                .filter(StringUtils::hasText)
                .map(this::classifyDrawingType)
                .filter(type -> !"UNKNOWN".equals(type))
                .findFirst()
                .orElse("UNKNOWN");
    }

    private double estimateFrameScore(
            DxfGeometryBox box,
            int labelCount,
            long roomLabelCount,
            int titleCount,
            long titleBlockMarkerCount,
            int canvasWidth,
            int canvasHeight
    ) {
        double areaRatio = (double) (box.width() * box.height()) / Math.max(1d, (double) canvasWidth * canvasHeight);
        double layerBoost = isPreferredCadFrameLayer(box.layer()) ? 0.12d : 0d;
        return Math.min(0.96d, 0.38d
                + Math.min(titleCount, 2) * 0.16d
                + Math.min(titleBlockMarkerCount, 2) * 0.12d
                + Math.min(roomLabelCount, 6) * 0.05d
                + Math.min(labelCount, 12) * 0.015d
                + Math.min(areaRatio, 0.45d)
                + layerBoost);
    }

    private boolean isFrameSubstantiallyCovered(DxfGeometryBox candidate, DxfGeometryBox selected) {
        if (candidate == null || selected == null) {
            return false;
        }
        int intersectionLeft = Math.max(candidate.x(), selected.x());
        int intersectionTop = Math.max(candidate.y(), selected.y());
        int intersectionRight = Math.min(candidate.x() + candidate.width(), selected.x() + selected.width());
        int intersectionBottom = Math.min(candidate.y() + candidate.height(), selected.y() + selected.height());
        int intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
        int intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
        double intersectionArea = (double) intersectionWidth * intersectionHeight;
        double candidateArea = Math.max(1d, (double) candidate.width() * candidate.height());
        return (intersectionArea / candidateArea) >= 0.86d;
    }

    private String buildFrameScaleHint(DxfGeometryBox box, DxfFrameAnalysis analysis) {
        String layoutText = StringUtils.hasText(normalizeCadLayoutName(box.layoutName()))
                ? "layout `" + box.layoutName() + "`"
                : "model space / layer";
        return "Nhan dien tu geometry DXF tren " + layoutText
                + ", layer `" + defaultText(box.layer(), "unknown") + "`, "
                + analysis.labelCount() + " text, "
                + analysis.roomLabelCount() + " room label.";
    }

    private String normalizeCadLayoutName(String layoutName) {
        if (!StringUtils.hasText(layoutName)) {
            return null;
        }
        String normalized = layoutName.trim();
        if ("Model".equalsIgnoreCase(normalized) || "Model_Space".equalsIgnoreCase(normalized)) {
            return "MODEL";
        }
        return normalized;
    }

    private Integer extractDxfFrameId(String sourceFloorKey) {
        if (!StringUtils.hasText(sourceFloorKey) || !sourceFloorKey.startsWith("DXF_FRAME:")) {
            return null;
        }
        try {
            return Integer.parseInt(sourceFloorKey.substring("DXF_FRAME:".length()).trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String extractDxfLayoutKey(String sourceFloorKey) {
        if (!StringUtils.hasText(sourceFloorKey) || !sourceFloorKey.startsWith("DXF_LAYOUT:")) {
            return null;
        }
        return normalizeCadLayoutName(sourceFloorKey.substring("DXF_LAYOUT:".length()).trim());
    }

    private DxfGeometryBox findDxfGeometryBoxById(List<DxfGeometryBox> geometryBoxes, Integer boxId) {
        if (geometryBoxes == null || geometryBoxes.isEmpty() || boxId == null) {
            return null;
        }
        return geometryBoxes.stream()
                .filter(box -> box != null && box.id() == boxId)
                .findFirst()
                .orElse(null);
    }

    private DxfGeometryBox findBestGeometryBoxForLabel(
            DxfTextLabel label,
            List<DxfGeometryBox> geometryBoxes,
            DxfGeometryBox activeFrame,
            String activeLayoutName
    ) {
        if (label == null || geometryBoxes == null || geometryBoxes.isEmpty()) {
            return null;
        }
        double activeFrameArea = activeFrame != null ? (double) activeFrame.width() * activeFrame.height() : Double.MAX_VALUE;
        return geometryBoxes.stream()
                .filter(box -> box != null)
                .filter(box -> activeFrame == null || isFrameSubstantiallyCovered(box, activeFrame) || geometryContainsLabel(activeFrame, label, 8))
                .filter(box -> activeLayoutName == null || activeLayoutName.equals(normalizeCadLayoutName(box.layoutName())))
                .filter(box -> geometryContainsLabel(box, label, 6))
                .filter(box -> box.width() >= 36 && box.height() >= 24)
                .filter(box -> box.width() <= 640 && box.height() <= 360)
                .filter(box -> !isIgnorableCadLayer(box.layer()))
                .filter(box -> ((double) box.width() * box.height()) <= activeFrameArea * 0.72d)
                .min(Comparator
                        .comparingInt((DxfGeometryBox box) -> geometryPriorityForRoomBoundary(box.entityType()))
                        .thenComparingInt(box -> box.width() * box.height()))
                .orElse(null);
    }

    private int geometryPriorityForRoomBoundary(String entityType) {
        String normalized = StringUtils.hasText(entityType) ? entityType.trim().toUpperCase(Locale.ROOT) : "";
        return switch (normalized) {
            case "HATCH" -> 0;
            case "CURVE_CLUSTER" -> 1;
            case "INSERT_BLOCK" -> 2;
            case "LINE_CLUSTER" -> 3;
            case "LINE_RECT" -> 4;
            case "LWPOLYLINE", "POLYLINE" -> 5;
            default -> 6;
        };
    }

    private boolean isIgnorableCadLayer(String layerName) {
        if (!StringUtils.hasText(layerName)) {
            return false;
        }
        String folded = foldToAscii(layerName).toLowerCase(Locale.ROOT);
        return folded.contains("defpoints")
                || folded.contains("dim")
                || folded.contains("kich thuoc")
                || folded.contains("axis")
                || folded.contains("truc")
                || folded.contains("grid")
                || folded.contains("hatch")
                || folded.contains("center")
                || folded.contains("hidden")
                || folded.contains("temp");
    }

    private boolean isPreferredCadFrameLayer(String layerName) {
        if (!StringUtils.hasText(layerName)) {
            return false;
        }
        String folded = foldToAscii(layerName).toLowerCase(Locale.ROOT);
        return folded.contains("khung")
                || folded.contains("frame")
                || folded.contains("sheet")
                || folded.contains("title")
                || folded.contains("viewport")
                || folded.contains("layout");
    }

    private boolean isLikelyTitleBlockInsert(DxfInsertMarker marker) {
        if (marker == null || (!StringUtils.hasText(marker.blockName()) && !StringUtils.hasText(marker.effectiveName()) && !StringUtils.hasText(marker.titleHint()))) {
            return false;
        }
        String sourceText = StringUtils.hasText(marker.titleHint())
                ? marker.titleHint()
                : (StringUtils.hasText(marker.effectiveName()) ? marker.effectiveName() : marker.blockName());
        String folded = foldToAscii(sourceText).toLowerCase(Locale.ROOT).replace('_', ' ').replace('-', ' ');
        return folded.contains("title")
                || folded.contains("khung ten")
                || folded.contains("title block")
                || folded.contains("sheet")
                || folded.contains("ban ve")
                || folded.contains("template")
                || "XREF".equalsIgnoreCase(marker.referenceKind());
    }

    private String humanizeCadBlockName(String blockName) {
        if (!StringUtils.hasText(blockName)) {
            return null;
        }
        return normalizePdfLabelText(blockName.replace('_', ' ').replace('-', ' '));
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private MapImportSuggestion buildFallbackSuggestion(MapImportFloor floor, String sourceFileType) {
        String polygonJson = StringUtils.hasText(floor.getPreviewBoundsJson())
                ? floor.getPreviewBoundsJson()
                : buildRectanglePolygonJson(
                        24,
                        24,
                        Math.max(120, defaultIfNull(floor.getWidthPx(), 1600) - 48),
                        Math.max(80, defaultIfNull(floor.getHeightPx(), 900) - 48)
                );
        return MapImportSuggestion.builder()
                .importFloor(floor)
                .suggestionType("UNKNOWN")
                .labelText("Nen ban ve da san sang de review")
                .normalizedName("Nen ban ve")
                .polygonJson(polygonJson)
                .colorHex("#94A3B8")
                .hasAssetSuggested(false)
                .confidenceScore(0.1d)
                .sourceMethod("MANUAL")
                .reviewStatus("PENDING")
                .notes("Chua trich duoc room label hop le tu " + sourceFileType + ". He thong da giu san bounding box cua ban ve con de admin review thu cong nhanh hon.")
                .build();
    }

    private List<MapImportSuggestion> buildSuggestionsFromPdfLabels(MapImportFloor floor, List<ParsedPdfLabel> labels) {
        List<MapImportSuggestion> suggestions = new ArrayList<>();
        for (ParsedPdfLabel label : labels) {
            suggestions.add(MapImportSuggestion.builder()
                    .importFloor(floor)
                    .suggestionType(label.suggestionType())
                    .labelText(label.text())
                    .normalizedName(label.normalizedName())
                    .polygonJson(label.polygonJson())
                    .colorHex(label.colorHex())
                    .hasAssetSuggested(label.hasAssetSuggested())
                    .confidenceScore(label.confidenceScore())
                    .sourceMethod("VECTOR")
                    .reviewStatus("PENDING")
                    .notes(label.notes())
                    .build());
        }
        return suggestions;
    }

    private List<ParsedPdfLabel> normalizeParsedPdfLabels(List<RawPdfLabel> rawLabels) {
        if (rawLabels == null || rawLabels.isEmpty()) {
            return List.of();
        }
        List<RawPdfLabel> ordered = rawLabels.stream()
                .sorted(Comparator.comparingInt(RawPdfLabel::y).thenComparingInt(RawPdfLabel::x))
                .toList();

        List<ParsedPdfLabel> results = new ArrayList<>();
        Set<String> deduplicationKeys = new LinkedHashSet<>();
        for (RawPdfLabel rawLabel : ordered) {
            String normalizedText = normalizePdfLabelText(rawLabel.text());
            if (!isLikelyLocationLabel(normalizedText)) {
                continue;
            }
            String suggestionType = classifySuggestionType(normalizedText);
            Boolean hasAssetSuggested = resolveHasAssetSuggestion(suggestionType);
            double confidenceScore = estimateConfidence(normalizedText, suggestionType);
            String normalizedName = buildNormalizedSuggestionName(normalizedText);
            String polygonJson = buildRectanglePolygonJson(rawLabel.x(), rawLabel.y(), rawLabel.width(), rawLabel.height());
            String deduplicationKey = normalizedName.toUpperCase(Locale.ROOT) + "@"
                    + Math.round(rawLabel.x() / 24.0) + ":" + Math.round(rawLabel.y() / 24.0);
            if (!deduplicationKeys.add(deduplicationKey)) {
                continue;
            }
            results.add(new ParsedPdfLabel(
                    normalizedText,
                    normalizedName,
                    suggestionType,
                    rawLabel.x(),
                    rawLabel.y(),
                    rawLabel.width(),
                    rawLabel.height(),
                    resolveSuggestionColor(suggestionType),
                    hasAssetSuggested,
                    confidenceScore,
                    polygonJson,
                    "Label trich tu PDF vector o vi tri x=" + rawLabel.x() + ", y=" + rawLabel.y()
            ));
            if (results.size() >= 40) {
                break;
            }
        }
        return results;
    }

    private String normalizePdfLabelText(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        String normalized = text
                .replace('\u00A0', ' ')
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        return StringUtils.hasText(normalized) ? normalized : null;
    }

    private boolean isLikelyLocationLabel(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String candidate = text.trim();
        if (candidate.length() < 2 || candidate.length() > 40) {
            return false;
        }
        String folded = foldToAscii(candidate).toLowerCase(Locale.ROOT);
        if (folded.contains("mat bang")
                || folded.contains("ghi chu")
                || folded.contains("scale")
                || folded.contains("ti le")
                || folded.contains("huong bac")
                || folded.contains("north")
                || folded.contains("section")
                || folded.contains("elevation")) {
            return false;
        }
        if (DIMENSION_ONLY_PATTERN.matcher(candidate).matches() && !candidate.matches("^\\d{2,5}[A-Za-z]?$")) {
            return false;
        }
        return true;
    }

    private String classifySuggestionType(String text) {
        String folded = foldToAscii(text).toLowerCase(Locale.ROOT);
        if (folded.contains("hanh lang") || folded.contains("corridor")) {
            return "CORRIDOR";
        }
        if (folded.contains("thang may") || folded.contains("elevator") || folded.contains("lift")) {
            return "ELEVATOR";
        }
        if (folded.contains("thang bo") || folded.contains("cau thang") || folded.contains("stair")) {
            return "STAIR";
        }
        if (folded.contains("san") || folded.contains("yard")) {
            return "YARD";
        }
        if (folded.contains("duong") || folded.contains("road")) {
            return "ROAD";
        }
        if (folded.contains("cong") || folded.contains("gate")) {
            return "GATE";
        }
        return "ROOM";
    }

    private Boolean resolveHasAssetSuggestion(String suggestionType) {
        return switch (suggestionType) {
            case "CORRIDOR", "STAIR", "ELEVATOR", "YARD", "ROAD", "GATE" -> false;
            case "ROOM" -> true;
            default -> null;
        };
    }

    private double estimateConfidence(String text, String suggestionType) {
        String folded = foldToAscii(text).toLowerCase(Locale.ROOT);
        if (!"ROOM".equals(suggestionType)) {
            return 0.88d;
        }
        if (folded.matches(".*\\b(p|phong|room|lab|wc|kho)\\b.*")) {
            return 0.84d;
        }
        if (folded.matches(".*\\d{2,5}[a-z]?.*")) {
            return 0.74d;
        }
        return 0.66d;
    }

    private String buildNormalizedSuggestionName(String text) {
        return normalizePdfLabelText(text);
    }

    private boolean isLikelyDrawingTitle(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String folded = foldToAscii(text).toLowerCase(Locale.ROOT);
        return folded.contains("mat bang")
                || folded.contains("floor plan")
                || folded.contains("mat cat")
                || folded.contains("mat dung")
                || folded.contains("phoi canh")
                || folded.contains("dien")
                || folded.contains("nuoc")
                || folded.contains("internet")
                || folded.contains("cua");
    }

    private String classifyDrawingType(String text) {
        String folded = foldToAscii(text).toLowerCase(Locale.ROOT);
        if (folded.contains("phoi canh")) {
            return "PERSPECTIVE";
        }
        if (folded.contains("mat dung")) {
            return "ELEVATION";
        }
        if (folded.contains("mat cat")) {
            return "SECTION";
        }
        if (folded.contains("dien") || folded.contains("nuoc") || folded.contains("internet")) {
            return "MEP";
        }
        if (folded.contains("cua")) {
            return "DOOR_SCHEDULE";
        }
        if (folded.contains("kich thuoc")) {
            return "DIMENSION_PLAN";
        }
        if (folded.contains("dinh vi")) {
            return "SITE_PLAN";
        }
        if (folded.contains("thang")) {
            return "STAIR_PLAN";
        }
        if (folded.contains("mat bang")) {
            return "FLOOR_PLAN";
        }
        return "UNKNOWN";
    }

    private boolean isPrimaryDrawingType(String drawingType) {
        return switch (drawingType) {
            case "FLOOR_PLAN", "DIMENSION_PLAN", "SITE_PLAN", "STAIR_PLAN" -> true;
            default -> false;
        };
    }

    private String buildFriendlyDrawingLabel(String title, int index) {
        String normalized = normalizePdfLabelText(title);
        if (StringUtils.hasText(normalized)) {
            return normalized;
        }
        return "Ban ve con " + (index + 1);
    }

    private double estimateDrawingCandidateConfidence(String title, String drawingType) {
        if (!StringUtils.hasText(title)) {
            return 0.2d;
        }
        return isPrimaryDrawingType(drawingType) ? 0.86d : 0.62d;
    }

    private boolean isLikelyCadRoomLabel(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String candidate = normalizePdfLabelText(text);
        if (!StringUtils.hasText(candidate) || candidate.length() > 50) {
            return false;
        }
        String folded = foldToAscii(candidate).toLowerCase(Locale.ROOT);
        if (isLikelyDrawingTitle(candidate)) {
            return false;
        }
        if (looksLikeMojibakeCadText(candidate, folded)) {
            return false;
        }
        if (folded.contains("truc") || folded.contains("cot") || folded.contains("scale") || folded.contains("ti le")) {
            return false;
        }
        return folded.matches(".*\\b(phong|p\\.|wc|bep|kho|hanh lang|san|cau thang|thang may|room|corridor|yard|gate)\\b.*")
                || folded.matches(".*\\d{2,5}[a-z]?.*");
    }

    private boolean looksLikeMojibakeCadText(String candidate, String folded) {
        if (!StringUtils.hasText(candidate)) {
            return true;
        }
        long nonAsciiLetterCount = candidate.chars()
                .filter(ch -> ch > 127 && Character.isLetter(ch))
                .count();
        if (nonAsciiLetterCount == 0) {
            return false;
        }
        String foldedValue = StringUtils.hasText(folded) ? folded : foldToAscii(candidate).toLowerCase(Locale.ROOT);
        boolean containsKnownKeyword = foldedValue.matches(".*\\b(phong|room|wc|bep|kho|hanh lang|san|cau thang|thang may|corridor|yard|gate)\\b.*");
        double nonAsciiRatio = (double) nonAsciiLetterCount / Math.max(candidate.length(), 1);
        return !containsKnownKeyword && nonAsciiRatio >= 0.3d;
    }

    private List<PdfLabelCluster> clusterPdfLabels(
            List<ParsedPdfLabel> parsedPdfLabels,
            Integer previewWidthPx,
            Integer previewHeightPx
    ) {
        List<PdfLabelClusterAccumulator> clusters = new ArrayList<>();
        int thresholdX = Math.max(180, (previewWidthPx != null ? previewWidthPx : 1600) / 6);
        int thresholdY = Math.max(140, (previewHeightPx != null ? previewHeightPx : 900) / 5);
        for (ParsedPdfLabel label : parsedPdfLabels) {
            PdfLabelClusterAccumulator target = null;
            for (PdfLabelClusterAccumulator candidate : clusters) {
                if (Math.abs(candidate.centerX() - label.x()) <= thresholdX
                        && Math.abs(candidate.centerY() - label.y()) <= thresholdY) {
                    target = candidate;
                    break;
                }
            }
            if (target == null) {
                target = new PdfLabelClusterAccumulator(label, previewWidthPx != null ? previewWidthPx : 1600, previewHeightPx != null ? previewHeightPx : 900);
                clusters.add(target);
            } else {
                target.add(label);
            }
        }
        return clusters.stream()
                .filter(cluster -> cluster.labelCount() >= 2)
                .map(PdfLabelClusterAccumulator::toCluster)
                .sorted(Comparator.comparingInt(PdfLabelCluster::minY).thenComparingInt(PdfLabelCluster::minX))
                .limit(12)
                .toList();
    }

    private String resolveSuggestionColor(String suggestionType) {
        return switch (suggestionType) {
            case "CORRIDOR" -> "#94A3B8";
            case "STAIR" -> "#8B5CF6";
            case "ELEVATOR" -> "#0EA5E9";
            case "YARD" -> "#22C55E";
            case "ROAD" -> "#64748B";
            case "GATE" -> "#F59E0B";
            case "ROOM" -> "#F97316";
            default -> "#94A3B8";
        };
    }

    private String buildRectanglePolygonJson(int x, int y, int width, int height) {
        Map<String, Object> polygon = new LinkedHashMap<>();
        polygon.put("type", "rect");
        polygon.put("x", x);
        polygon.put("y", y);
        polygon.put("width", Math.max(width, 12));
        polygon.put("height", Math.max(height, 12));
        return writeMetadata(polygon);
    }

    private String toPolygonJson(CadEngineBoundsResult bounds) {
        if (bounds == null) {
            return null;
        }
        return buildRectanglePolygonJson(
                bounds.x() != null ? bounds.x() : 0,
                bounds.y() != null ? bounds.y() : 0,
                bounds.width() != null ? bounds.width() : 12,
                bounds.height() != null ? bounds.height() : 12
        );
    }

    private Map<String, Object> toMetadataMap(ParsedPdfLabel label) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("text", label.text());
        metadata.put("normalizedName", label.normalizedName());
        metadata.put("suggestionType", label.suggestionType());
        metadata.put("x", label.x());
        metadata.put("y", label.y());
        metadata.put("width", label.width());
        metadata.put("height", label.height());
        metadata.put("colorHex", label.colorHex());
        metadata.put("hasAssetSuggested", label.hasAssetSuggested());
        metadata.put("confidenceScore", label.confidenceScore());
        metadata.put("polygonJson", label.polygonJson());
        metadata.put("notes", label.notes());
        return metadata;
    }

    private Map<String, Object> toMetadataMap(DxfTextLabel label) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("text", label.text());
        metadata.put("entityType", label.entityType());
        metadata.put("layer", label.layer());
        metadata.put("layoutName", label.layoutName());
        metadata.put("rawX", label.rawX());
        metadata.put("rawY", label.rawY());
        metadata.put("x", label.x());
        metadata.put("y", label.y());
        return metadata;
    }

    private Map<String, Object> toMetadataMap(DxfGeometryBox box) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("id", box.id());
        metadata.put("entityType", box.entityType());
        metadata.put("layer", box.layer());
        metadata.put("layoutName", box.layoutName());
        metadata.put("rawMinX", box.rawMinX());
        metadata.put("rawMinY", box.rawMinY());
        metadata.put("rawMaxX", box.rawMaxX());
        metadata.put("rawMaxY", box.rawMaxY());
        metadata.put("x", box.x());
        metadata.put("y", box.y());
        metadata.put("width", box.width());
        metadata.put("height", box.height());
        return metadata;
    }

    private Map<String, Object> toMetadataMap(DxfInsertMarker marker) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("id", marker.id());
        metadata.put("blockName", marker.blockName());
        metadata.put("effectiveName", marker.effectiveName());
        metadata.put("referenceKind", marker.referenceKind());
        metadata.put("titleHint", marker.titleHint());
        metadata.put("layer", marker.layer());
        metadata.put("layoutName", marker.layoutName());
        metadata.put("rawX", marker.rawX());
        metadata.put("rawY", marker.rawY());
        metadata.put("scaleX", marker.scaleX());
        metadata.put("scaleY", marker.scaleY());
        metadata.put("rotationDegrees", marker.rotationDegrees());
        metadata.put("x", marker.x());
        metadata.put("y", marker.y());
        return metadata;
    }

    private String summarizeEntityStats(Map<String, Integer> entityStats) {
        if (entityStats == null || entityStats.isEmpty()) {
            return "{}";
        }
        return entityStats.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .limit(12)
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(", ", "{", "}"));
    }

    private String summarizeTopEntityTypes(Map<String, Integer> entityStats) {
        if (entityStats == null || entityStats.isEmpty()) {
            return "[]";
        }
        return entityStats.entrySet().stream()
                .filter(entry -> entry.getValue() != null && entry.getValue() > 0)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(8)
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(", ", "[", "]"));
    }

    private String summarizeTopLayers(List<DxfGeometryBox> geometryBoxes, List<DxfTextLabel> labels) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        if (geometryBoxes != null) {
            for (DxfGeometryBox box : geometryBoxes) {
                String key = normalizeCadStatKey(box != null ? box.layer() : null, "no-layer");
                counts.merge(key, 1, Integer::sum);
            }
        }
        if (labels != null) {
            for (DxfTextLabel label : labels) {
                String key = normalizeCadStatKey(label != null ? label.layer() : null, "no-layer");
                counts.merge(key, 1, Integer::sum);
            }
        }
        return summarizeTopCountMap(counts);
    }

    private String summarizeTopBlocks(List<DxfInsertMarker> insertMarkers) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        if (insertMarkers != null) {
            for (DxfInsertMarker marker : insertMarkers) {
                String base = StringUtils.hasText(marker != null ? marker.effectiveName() : null)
                        ? marker.effectiveName()
                        : (marker != null ? marker.blockName() : null);
                String normalized = normalizeCadStatKey(base, "unknown-block");
                String kind = marker != null && StringUtils.hasText(marker.referenceKind()) ? marker.referenceKind() : "BLOCK";
                counts.merge(kind + ":" + normalized, 1, Integer::sum);
            }
        }
        return summarizeTopCountMap(counts);
    }

    private String summarizeTopCountMap(Map<String, Integer> counts) {
        if (counts == null || counts.isEmpty()) {
            return "[]";
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(8)
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(", ", "[", "]"));
    }

    private String normalizeCadStatKey(String value, String fallback) {
        if (!StringUtils.hasText(value)) {
            return fallback;
        }
        String normalized = value.trim().replace('\n', ' ').replace('\r', ' ');
        return normalized.length() > 48 ? normalized.substring(0, 48) : normalized;
    }

    private String foldToAscii(String text) {
        if (!StringUtils.hasText(text)) {
            return "";
        }
        String normalized = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}+", "");
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && StringUtils.hasText(text)) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text && StringUtils.hasText(text)) {
            try {
                return Double.parseDouble(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private Boolean asBoolean(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value instanceof String text && StringUtils.hasText(text)) {
            return Boolean.parseBoolean(text.trim());
        }
        return null;
    }

    private MapImportJobSummaryResponse mapJobSummary(MapImportJob job) {
        String requestedByName = null;
        if (job.getRequestedBy() != null) {
            requestedByName = StringUtils.hasText(job.getRequestedBy().getFullName())
                    ? job.getRequestedBy().getFullName().trim()
                    : job.getRequestedBy().getUsername();
        }

        return MapImportJobSummaryResponse.builder()
                .id(job.getId())
                .sourceFileName(job.getSourceFileName())
                .sourceFileType(job.getSourceFileType())
                .sourceFileUrl(job.getSourceFileUrl())
                .status(job.getStatus())
                .errorMessage(job.getErrorMessage())
                .previewFileUrl(job.getPreviewFileUrl())
                .pageCount(job.getPageCount())
                .detectedFloorCount(job.getDetectedFloorCount())
                .rawMetadataJson(job.getRawMetadataJson())
                .requestedByName(requestedByName)
                .requestedAt(job.getRequestedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    private MapImportJobDetailResponse mapJobDetail(MapImportJob job) {
        List<MapImportFloor> floors = new ArrayList<>(Optional.ofNullable(job.getFloors()).orElse(List.of()));
        floors.sort((left, right) -> {
            int compareSortOrder = compareNullableInteger(left.getSortOrder(), right.getSortOrder());
            if (compareSortOrder != 0) {
                return compareSortOrder;
            }
            return compareNullableLong(left.getId(), right.getId());
        });

        List<MapImportFloorResponse> floorResponses = floors.stream()
                .map(this::mapFloor)
                .toList();

        return MapImportJobDetailResponse.builder()
                .job(mapJobSummary(job))
                .floors(floorResponses)
                .build();
    }

    private MapImportFloorResponse mapFloor(MapImportFloor floor) {
        List<MapImportSuggestion> suggestions = new ArrayList<>(Optional.ofNullable(floor.getSuggestions()).orElse(List.of()));
        suggestions.sort((left, right) -> compareNullableLong(left.getId(), right.getId()));
        List<MapFloorResponse> availableTargetFloors = mapFloorRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(existingFloor -> MapFloorResponse.builder()
                        .id(existingFloor.getId())
                        .name(existingFloor.getName())
                        .sortOrder(existingFloor.getSortOrder())
                        .gridRows(existingFloor.getGridRows())
                        .gridCols(existingFloor.getGridCols())
                        .canvasBackgroundColor(existingFloor.getCanvasBackgroundColor())
                        .roomShapes(List.of())
                        .build())
                .toList();
        return MapImportFloorResponse.builder()
                .id(floor.getId())
                .sourceFloorKey(floor.getSourceFloorKey())
                .suggestedName(floor.getSuggestedName())
                .friendlyLabel(floor.getFriendlyLabel())
                .drawingType(floor.getDrawingType())
                .pageNumber(floor.getPageNumber())
                .sortOrder(floor.getSortOrder())
                .widthPx(floor.getWidthPx())
                .heightPx(floor.getHeightPx())
                .scaleHint(floor.getScaleHint())
                .backgroundImageUrl(floor.getBackgroundImageUrl())
                .previewBoundsJson(floor.getPreviewBoundsJson())
                .detectionConfidence(floor.getDetectionConfidence())
                .selectedForAnalysis(floor.getSelectedForAnalysis())
                .parseStatus(floor.getParseStatus())
                .sourceImageWidthPx(resolveFloorSourceImageWidth(floor))
                .sourceImageHeightPx(resolveFloorSourceImageHeight(floor))
                .suggestedTargetFloorId(findSuggestedTargetFloorId(floor))
                .availableTargetFloors(availableTargetFloors)
                .suggestions(suggestions.stream().map(this::mapSuggestion).toList())
                .build();
    }

    private Integer resolveFloorSourceImageWidth(MapImportFloor floor) {
        String rawMetadataJson = floor.getJob() != null ? floor.getJob().getRawMetadataJson() : null;
        Integer previewWidth = extractMetadataInteger(rawMetadataJson, "previewWidthPx");
        return previewWidth != null ? previewWidth : extractMetadataInteger(rawMetadataJson, "dxfCanvasWidthPx");
    }

    private Integer resolveFloorSourceImageHeight(MapImportFloor floor) {
        String rawMetadataJson = floor.getJob() != null ? floor.getJob().getRawMetadataJson() : null;
        Integer previewHeight = extractMetadataInteger(rawMetadataJson, "previewHeightPx");
        return previewHeight != null ? previewHeight : extractMetadataInteger(rawMetadataJson, "dxfCanvasHeightPx");
    }

    private Integer findSuggestedTargetFloorId(MapImportFloor floor) {
        String suggestedName = normalizeOrNull(floor.getSuggestedName());
        if (!StringUtils.hasText(suggestedName)) {
            return null;
        }
        return mapFloorRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .filter(existingFloor -> suggestedName.equalsIgnoreCase(normalizeOrNull(existingFloor.getName())))
                .map(MapFloor::getId)
                .findFirst()
                .orElse(null);
    }

    private MapImportSuggestionResponse mapSuggestion(MapImportSuggestion suggestion) {
        return MapImportSuggestionResponse.builder()
                .id(suggestion.getId())
                .suggestionType(suggestion.getSuggestionType())
                .labelText(suggestion.getLabelText())
                .normalizedName(suggestion.getNormalizedName())
                .cellsJson(suggestion.getCellsJson())
                .polygonJson(suggestion.getPolygonJson())
                .colorHex(suggestion.getColorHex())
                .hasAssetSuggested(suggestion.getHasAssetSuggested())
                .confidenceScore(suggestion.getConfidenceScore())
                .sourceMethod(suggestion.getSourceMethod())
                .reviewStatus(suggestion.getReviewStatus())
                .linkedLocationId(suggestion.getLinkedLocationId())
                .notes(suggestion.getNotes())
                .build();
    }

    private int compareNullableInteger(Integer left, Integer right) {
        return Integer.compare(left != null ? left : Integer.MAX_VALUE, right != null ? right : Integer.MAX_VALUE);
    }

    private int compareNullableLong(Long left, Long right) {
        return Long.compare(left != null ? left : Long.MAX_VALUE, right != null ? right : Long.MAX_VALUE);
    }

    private static class PositionedPdfLabelStripper extends PDFTextStripper {

        private final List<RawPdfLabel> rawLabels = new ArrayList<>();
        private final float scaleX;
        private final float scaleY;

        private PositionedPdfLabelStripper(int previewWidthPx, int previewHeightPx, float pageWidth, float pageHeight) throws Exception {
            this.scaleX = pageWidth > 0 ? previewWidthPx / pageWidth : 1f;
            this.scaleY = pageHeight > 0 ? previewHeightPx / pageHeight : 1f;
        }

        @Override
        protected void writeString(String text, List<TextPosition> textPositions) throws java.io.IOException {
            super.writeString(text, textPositions);
            if (!StringUtils.hasText(text) || textPositions == null || textPositions.isEmpty()) {
                return;
            }
            float minX = Float.MAX_VALUE;
            float minY = Float.MAX_VALUE;
            float maxX = Float.MIN_VALUE;
            float maxY = Float.MIN_VALUE;
            for (TextPosition textPosition : textPositions) {
                minX = Math.min(minX, textPosition.getXDirAdj());
                minY = Math.min(minY, textPosition.getYDirAdj());
                maxX = Math.max(maxX, textPosition.getXDirAdj() + textPosition.getWidthDirAdj());
                maxY = Math.max(maxY, textPosition.getYDirAdj() + textPosition.getHeightDir());
            }
            if (minX == Float.MAX_VALUE || minY == Float.MAX_VALUE) {
                return;
            }
            rawLabels.add(new RawPdfLabel(
                    text,
                    Math.max(0, Math.round(minX * scaleX)),
                    Math.max(0, Math.round(minY * scaleY)),
                    Math.max(8, Math.round((maxX - minX) * scaleX)),
                    Math.max(8, Math.round((maxY - minY) * scaleY))
            ));
        }

        private List<RawPdfLabel> getRawLabels() {
            return rawLabels;
        }
    }

    private record RawPdfLabel(String text, int x, int y, int width, int height) {
    }

    private record ParsedPdfLabel(
            String text,
            String normalizedName,
            String suggestionType,
            int x,
            int y,
            int width,
            int height,
            String colorHex,
            Boolean hasAssetSuggested,
            double confidenceScore,
            String polygonJson,
            String notes
    ) {
    }

    private record DxfPreparedData(
            String effectiveDxfFileUrl,
            int canvasWidthPx,
            int canvasHeightPx,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes,
            List<DxfInsertMarker> insertMarkers
    ) {
    }

    private record DxfFrameAnalysis(
            DxfGeometryBox box,
            String title,
            String drawingType,
            int labelCount,
            long roomLabelCount,
            long titleBlockMarkerCount,
            double score
    ) {
    }

    private record PdfPreviewData(String previewFileUrl, Integer pageCount, Integer widthPx, Integer heightPx) {
    }

    @Builder
    private record DetectedDrawingCandidate(
            String sourceFloorKey,
            String suggestedName,
            String friendlyLabel,
            String drawingType,
            Integer pageNumber,
            Integer sortOrder,
            Integer widthPx,
            Integer heightPx,
            String scaleHint,
            String backgroundImageUrl,
            String previewBoundsJson,
            Double detectionConfidence,
            Boolean selectedForAnalysis
    ) {
    }

    private record PdfLabelCluster(
            int minX,
            int minY,
            int width,
            int height,
            int pageWidth,
            int pageHeight,
            double confidence
    ) {
    }

    private static class PdfLabelClusterAccumulator {
        private final int pageWidth;
        private final int pageHeight;
        private int minX;
        private int minY;
        private int maxX;
        private int maxY;
        private int sumX;
        private int sumY;
        private int count;

        private PdfLabelClusterAccumulator(ParsedPdfLabel firstLabel, int pageWidth, int pageHeight) {
            this.pageWidth = pageWidth;
            this.pageHeight = pageHeight;
            this.minX = firstLabel.x();
            this.minY = firstLabel.y();
            this.maxX = firstLabel.x() + Math.max(firstLabel.width(), 12);
            this.maxY = firstLabel.y() + Math.max(firstLabel.height(), 12);
            this.sumX = firstLabel.x();
            this.sumY = firstLabel.y();
            this.count = 1;
        }

        private void add(ParsedPdfLabel label) {
            this.minX = Math.min(this.minX, label.x());
            this.minY = Math.min(this.minY, label.y());
            this.maxX = Math.max(this.maxX, label.x() + Math.max(label.width(), 12));
            this.maxY = Math.max(this.maxY, label.y() + Math.max(label.height(), 12));
            this.sumX += label.x();
            this.sumY += label.y();
            this.count += 1;
        }

        private int centerX() {
            return count <= 0 ? 0 : Math.round(sumX / (float) count);
        }

        private int centerY() {
            return count <= 0 ? 0 : Math.round(sumY / (float) count);
        }

        private int labelCount() {
            return count;
        }

        private PdfLabelCluster toCluster() {
            int paddedMinX = Math.max(0, minX - 120);
            int paddedMinY = Math.max(0, minY - 120);
            int paddedMaxX = Math.min(pageWidth, maxX + 120);
            int paddedMaxY = Math.min(pageHeight, maxY + 120);
            return new PdfLabelCluster(
                    paddedMinX,
                    paddedMinY,
                    Math.max(160, paddedMaxX - paddedMinX),
                    Math.max(120, paddedMaxY - paddedMinY),
                    pageWidth,
                    pageHeight,
                    Math.min(0.92d, 0.45d + (count * 0.08d))
            );
        }
    }
}
