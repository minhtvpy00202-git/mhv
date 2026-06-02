package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class DxfProcessingService {

    public DxfParseResult parse(Path dxfFile) {
        if (dxfFile == null || !Files.isRegularFile(dxfFile)) {
            throw new CustomException("Khong tim thay file DXF de phan tich.");
        }
        try {
            List<String> lines = readAllLinesFallback(dxfFile);
            List<RawDxfTextEntity> rawTexts = extractTextEntities(lines);
            return normalize(rawTexts);
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Khong the doc noi dung DXF.");
        }
    }

    private List<String> readAllLinesFallback(Path dxfFile) throws Exception {
        try {
            return Files.readAllLines(dxfFile, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return Files.readAllLines(dxfFile, StandardCharsets.ISO_8859_1);
        }
    }

    private List<RawDxfTextEntity> extractTextEntities(List<String> lines) {
        List<RawDxfTextEntity> results = new ArrayList<>();
        RawDxfTextEntityBuilder current = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (current != null && current.isComplete()) {
                    results.add(current.build());
                }
                if (isTextEntityType(value)) {
                    current = new RawDxfTextEntityBuilder(value.trim().toUpperCase(Locale.ROOT));
                } else {
                    current = null;
                }
                continue;
            }
            if (current == null) {
                continue;
            }
            current.accept(code, value);
        }
        if (current != null && current.isComplete()) {
            results.add(current.build());
        }
        return results;
    }

    private boolean isTextEntityType(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        String type = value.trim().toUpperCase(Locale.ROOT);
        return "TEXT".equals(type) || "MTEXT".equals(type) || "ATTRIB".equals(type);
    }

    private DxfParseResult normalize(List<RawDxfTextEntity> rawTexts) {
        if (rawTexts.isEmpty()) {
            return new DxfParseResult(1600, 900, List.of());
        }
        double minX = rawTexts.stream().mapToDouble(RawDxfTextEntity::rawX).min().orElse(0d);
        double maxX = rawTexts.stream().mapToDouble(RawDxfTextEntity::rawX).max().orElse(minX + 1d);
        double minY = rawTexts.stream().mapToDouble(RawDxfTextEntity::rawY).min().orElse(0d);
        double maxY = rawTexts.stream().mapToDouble(RawDxfTextEntity::rawY).max().orElse(minY + 1d);
        double rangeX = Math.max(maxX - minX, 1d);
        double rangeY = Math.max(maxY - minY, 1d);
        int canvasWidth = Math.max(1200, Math.min(2400, (int) Math.round((rangeX / rangeY) * 1000)));
        int canvasHeight = Math.max(900, Math.min(1800, (int) Math.round((rangeY / rangeX) * 1400)));
        List<DxfTextLabel> labels = new ArrayList<>();
        for (RawDxfTextEntity rawText : rawTexts) {
            String normalizedText = normalizeText(rawText.text());
            if (!StringUtils.hasText(normalizedText)) {
                continue;
            }
            int x = normalizeAxis(rawText.rawX(), minX, rangeX, canvasWidth);
            int y = normalizeAxis(maxY - rawText.rawY(), 0d, rangeY, canvasHeight);
            labels.add(new DxfTextLabel(
                    normalizedText,
                    rawText.entityType(),
                    rawText.layer(),
                    rawText.layoutName(),
                    rawText.rawX(),
                    rawText.rawY(),
                    x,
                    y
            ));
        }
        return new DxfParseResult(canvasWidth, canvasHeight, labels);
    }

    private int normalizeAxis(double value, double min, double range, int canvasSize) {
        double safeRange = Math.max(range, 1d);
        double ratio = (value - min) / safeRange;
        double scaled = 50 + (ratio * Math.max(canvasSize - 100, 100));
        return (int) Math.max(0, Math.min(canvasSize, Math.round(scaled)));
    }

    private String normalizeText(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        String normalized = text
                .replace("\\P", " ")
                .replace("\\X", " ")
                .replace("{", " ")
                .replace("}", " ")
                .replace("%%u", "")
                .replace("%%d", "°")
                .replaceAll("\\\\A[0-9];", " ")
                .replaceAll("\\\\f[^;]*;", " ")
                .replaceAll("\\\\H[^;]*;", " ")
                .replaceAll("\\\\C[^;]*;", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return StringUtils.hasText(normalized) ? normalized : null;
    }

    private static class RawDxfTextEntityBuilder {
        private final String entityType;
        private final StringBuilder text = new StringBuilder();
        private String layer;
        private String layoutName;
        private Double rawX;
        private Double rawY;

        private RawDxfTextEntityBuilder(String entityType) {
            this.entityType = entityType;
        }

        private void accept(String code, String value) {
            if ("1".equals(code) || "3".equals(code)) {
                if (StringUtils.hasText(value)) {
                    if (!text.isEmpty()) {
                        text.append(' ');
                    }
                    text.append(value.trim());
                }
                return;
            }
            if ("8".equals(code)) {
                layer = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("410".equals(code)) {
                layoutName = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("10".equals(code) && rawX == null) {
                rawX = parseDouble(value);
                return;
            }
            if ("20".equals(code) && rawY == null) {
                rawY = parseDouble(value);
            }
        }

        private boolean isComplete() {
            return StringUtils.hasText(text.toString()) && rawX != null && rawY != null;
        }

        private RawDxfTextEntity build() {
            return new RawDxfTextEntity(entityType, text.toString(), layer, layoutName, rawX != null ? rawX : 0d, rawY != null ? rawY : 0d);
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private record RawDxfTextEntity(
            String entityType,
            String text,
            String layer,
            String layoutName,
            double rawX,
            double rawY
    ) {
    }

    public record DxfTextLabel(
            String text,
            String entityType,
            String layer,
            String layoutName,
            double rawX,
            double rawY,
            int x,
            int y
    ) {
    }

    public record DxfParseResult(
            int canvasWidthPx,
            int canvasHeightPx,
            List<DxfTextLabel> labels
    ) {
    }
}
