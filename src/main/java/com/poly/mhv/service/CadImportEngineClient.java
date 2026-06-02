package com.poly.mhv.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.poly.mhv.entity.MapImportFloor;
import com.poly.mhv.entity.MapImportJob;
import com.poly.mhv.exception.CustomException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CadImportEngineClient {

    private final boolean enabled;
    private final String baseUrl;
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public CadImportEngineClient(
            @Value("${app.asset-map-import.cad-engine.enabled:false}") boolean enabled,
            @Value("${app.asset-map-import.cad-engine.base-url:}") String baseUrl,
            @Value("${app.asset-map-import.cad-engine.api-key:}") String apiKey,
            @Value("${app.asset-map-import.cad-engine.connect-timeout-ms:15000}") long connectTimeoutMs,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.baseUrl = StringUtils.hasText(baseUrl) ? baseUrl.trim().replaceAll("/+$", "") : "";
        this.apiKey = StringUtils.hasText(apiKey) ? apiKey.trim() : null;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(connectTimeoutMs, 1000L)))
                .build();
        this.objectMapper = objectMapper;
    }

    public boolean isEnabledFor(String sourceFileType) {
        if (!enabled || !StringUtils.hasText(baseUrl) || !StringUtils.hasText(sourceFileType)) {
            return false;
        }
        String normalized = sourceFileType.trim().toUpperCase();
        return "DWG".equals(normalized) || "DXF".equals(normalized);
    }

    public CadEngineDiscoverResponse discoverDrawings(MapImportJob job) {
        return postJson(
                "/discover",
                new CadEngineDiscoverRequest(
                        job.getId(),
                        job.getSourceFileName(),
                        job.getSourceFileType(),
                        job.getSourceFileUrl()
                ),
                CadEngineDiscoverResponse.class,
                "Khong the ket noi CAD engine de tach ban ve con."
        );
    }

    public CadEngineParseResponse parseSelectedDrawings(MapImportJob job, List<MapImportFloor> floors) {
        List<CadEngineSelectedSheetRequest> selectedSheets = floors.stream()
                .map(floor -> new CadEngineSelectedSheetRequest(
                        floor.getId(),
                        floor.getSourceFloorKey(),
                        floor.getSuggestedName(),
                        floor.getFriendlyLabel(),
                        floor.getDrawingType(),
                        floor.getBackgroundImageUrl(),
                        floor.getPreviewBoundsJson()
                ))
                .toList();
        return postJson(
                "/parse-selected",
                new CadEngineParseRequest(
                        job.getId(),
                        job.getSourceFileName(),
                        job.getSourceFileType(),
                        job.getSourceFileUrl(),
                        selectedSheets
                ),
                CadEngineParseResponse.class,
                "Khong the ket noi CAD engine de parse DWG/DXF."
        );
    }

    private <T> T postJson(String path, Object body, Class<T> responseType, String errorMessage) {
        if (!StringUtils.hasText(baseUrl)) {
            throw new CustomException("CAD engine chua duoc cau hinh base URL.");
        }
        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + path))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (StringUtils.hasText(apiKey)) {
                requestBuilder.header("X-Api-Key", apiKey);
            }
            HttpResponse<String> response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CustomException(errorMessage);
            }
            return objectMapper.readValue(response.body(), responseType);
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException(errorMessage);
        }
    }

    private record CadEngineDiscoverRequest(
            Long jobId,
            String sourceFileName,
            String sourceFileType,
            String sourceFileUrl
    ) {
    }

    private record CadEngineParseRequest(
            Long jobId,
            String sourceFileName,
            String sourceFileType,
            String sourceFileUrl,
            List<CadEngineSelectedSheetRequest> selectedSheets
    ) {
    }

    private record CadEngineSelectedSheetRequest(
            Long importFloorId,
            String sourceFloorKey,
            String suggestedName,
            String friendlyLabel,
            String drawingType,
            String previewImageUrl,
            String previewBoundsJson
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineDiscoverResponse(
            String engineName,
            List<CadEngineSheetResult> sheets
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineParseResponse(
            String engineName,
            List<CadEngineParsedSheetResult> sheets
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineSheetResult(
            String sheetKey,
            String title,
            String drawingType,
            Integer pageNumber,
            Integer sortOrder,
            Integer widthPx,
            Integer heightPx,
            String previewImageUrl,
            CadEngineBoundsResult previewBounds,
            Double confidence,
            Boolean selectedByDefault,
            String notes
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineParsedSheetResult(
            String sheetKey,
            List<CadEngineSuggestionResult> suggestions
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineSuggestionResult(
            String labelText,
            String normalizedName,
            String suggestionType,
            CadEngineBoundsResult bounds,
            String colorHex,
            Boolean hasAssetSuggested,
            Double confidenceScore,
            String sourceMethod,
            String notes
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CadEngineBoundsResult(
            Integer x,
            Integer y,
            Integer width,
            Integer height
    ) {
    }
}
