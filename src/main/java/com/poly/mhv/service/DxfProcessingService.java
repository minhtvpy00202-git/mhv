package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
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
            List<RawDxfGeometryBox> rawGeometryBoxes = extractGeometryBoxes(lines);
            return normalize(rawTexts, rawGeometryBoxes);
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

    private List<RawDxfGeometryBox> extractGeometryBoxes(List<String> lines) {
        List<RawDxfGeometryBox> results = new ArrayList<>();
        RawDxfPolylineBuilder currentPolyline = null;
        RawDxfVertexBuilder currentVertex = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (currentVertex != null && currentPolyline != null) {
                    currentPolyline.addVertex(currentVertex.x(), currentVertex.y());
                    currentVertex = null;
                }
                String entityType = normalizeEntityType(value);
                if (currentPolyline != null) {
                    if ("VERTEX".equals(entityType)) {
                        currentVertex = new RawDxfVertexBuilder();
                        continue;
                    }
                    if ("SEQEND".equals(entityType)) {
                        RawDxfGeometryBox box = currentPolyline.buildBox();
                        if (box != null) {
                            results.add(box);
                        }
                        currentPolyline = null;
                        continue;
                    }
                    RawDxfGeometryBox box = currentPolyline.buildBox();
                    if (box != null) {
                        results.add(box);
                    }
                    currentPolyline = null;
                }
                if ("LWPOLYLINE".equals(entityType) || "POLYLINE".equals(entityType)) {
                    currentPolyline = new RawDxfPolylineBuilder(entityType);
                }
                continue;
            }
            if (currentVertex != null) {
                currentVertex.accept(code, value);
                continue;
            }
            if (currentPolyline != null) {
                currentPolyline.accept(code, value);
            }
        }
        if (currentVertex != null && currentPolyline != null) {
            currentPolyline.addVertex(currentVertex.x(), currentVertex.y());
        }
        if (currentPolyline != null) {
            RawDxfGeometryBox box = currentPolyline.buildBox();
            if (box != null) {
                results.add(box);
            }
        }
        return deduplicateGeometryBoxes(results);
    }

    private List<RawDxfGeometryBox> deduplicateGeometryBoxes(List<RawDxfGeometryBox> boxes) {
        if (boxes == null || boxes.isEmpty()) {
            return List.of();
        }
        List<RawDxfGeometryBox> results = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        for (RawDxfGeometryBox box : boxes) {
            if (box == null) {
                continue;
            }
            String key = normalizeValue(box.layoutName()) + "|"
                    + normalizeValue(box.layer()) + "|"
                    + Math.round(box.minX() * 10d) + "|"
                    + Math.round(box.minY() * 10d) + "|"
                    + Math.round(box.maxX() * 10d) + "|"
                    + Math.round(box.maxY() * 10d);
            if (keys.add(key)) {
                results.add(box);
            }
        }
        return results;
    }

    private DxfParseResult normalize(List<RawDxfTextEntity> rawTexts, List<RawDxfGeometryBox> rawGeometryBoxes) {
        if (rawTexts.isEmpty() && rawGeometryBoxes.isEmpty()) {
            return new DxfParseResult(1600, 900, List.of(), List.of());
        }
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;

        for (RawDxfTextEntity rawText : rawTexts) {
            minX = Math.min(minX, rawText.rawX());
            maxX = Math.max(maxX, rawText.rawX());
            minY = Math.min(minY, rawText.rawY());
            maxY = Math.max(maxY, rawText.rawY());
        }
        for (RawDxfGeometryBox rawBox : rawGeometryBoxes) {
            minX = Math.min(minX, rawBox.minX());
            maxX = Math.max(maxX, rawBox.maxX());
            minY = Math.min(minY, rawBox.minY());
            maxY = Math.max(maxY, rawBox.maxY());
        }
        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
            return new DxfParseResult(1600, 900, List.of(), List.of());
        }
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
        List<DxfGeometryBox> geometryBoxes = new ArrayList<>();
        int nextGeometryId = 1;
        for (RawDxfGeometryBox rawBox : rawGeometryBoxes) {
            int left = normalizeAxis(rawBox.minX(), minX, rangeX, canvasWidth);
            int right = normalizeAxis(rawBox.maxX(), minX, rangeX, canvasWidth);
            int top = normalizeAxis(maxY - rawBox.maxY(), 0d, rangeY, canvasHeight);
            int bottom = normalizeAxis(maxY - rawBox.minY(), 0d, rangeY, canvasHeight);
            int x = Math.min(left, right);
            int y = Math.min(top, bottom);
            int width = Math.max(12, Math.abs(right - left));
            int height = Math.max(12, Math.abs(bottom - top));
            geometryBoxes.add(new DxfGeometryBox(
                    nextGeometryId++,
                    rawBox.entityType(),
                    rawBox.layer(),
                    rawBox.layoutName(),
                    rawBox.minX(),
                    rawBox.minY(),
                    rawBox.maxX(),
                    rawBox.maxY(),
                    x,
                    y,
                    width,
                    height
            ));
        }
        return new DxfParseResult(canvasWidth, canvasHeight, labels, geometryBoxes);
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

    private String normalizeEntityType(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "";
    }

    private String normalizeValue(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
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

    private static class RawDxfPolylineBuilder {
        private final String entityType;
        private final List<double[]> points = new ArrayList<>();
        private String layer;
        private String layoutName;
        private int flags;
        private Double pendingX;

        private RawDxfPolylineBuilder(String entityType) {
            this.entityType = entityType;
        }

        private void accept(String code, String value) {
            if ("8".equals(code)) {
                layer = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("410".equals(code)) {
                layoutName = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("70".equals(code)) {
                Integer parsed = parseInteger(value);
                flags = parsed != null ? parsed : 0;
                return;
            }
            if ("10".equals(code)) {
                pendingX = parseDouble(value);
                return;
            }
            if ("20".equals(code) && pendingX != null) {
                Double parsedY = parseDouble(value);
                if (parsedY != null) {
                    points.add(new double[]{pendingX, parsedY});
                }
                pendingX = null;
            }
        }

        private void addVertex(Double x, Double y) {
            if (x != null && y != null) {
                points.add(new double[]{x, y});
            }
        }

        private RawDxfGeometryBox buildBox() {
            if (points.size() < 4) {
                return null;
            }
            double minX = Double.POSITIVE_INFINITY;
            double maxX = Double.NEGATIVE_INFINITY;
            double minY = Double.POSITIVE_INFINITY;
            double maxY = Double.NEGATIVE_INFINITY;
            Set<Long> distinctXs = new LinkedHashSet<>();
            Set<Long> distinctYs = new LinkedHashSet<>();
            for (double[] point : points) {
                minX = Math.min(minX, point[0]);
                maxX = Math.max(maxX, point[0]);
                minY = Math.min(minY, point[1]);
                maxY = Math.max(maxY, point[1]);
                distinctXs.add(Math.round(point[0] * 100d));
                distinctYs.add(Math.round(point[1] * 100d));
            }
            double width = maxX - minX;
            double height = maxY - minY;
            if (width < 1d || height < 1d) {
                return null;
            }
            boolean closed = (flags & 1) == 1 || looksClosed();
            if (!closed) {
                return null;
            }
            boolean axisAlignedEnough = distinctXs.size() <= 3 && distinctYs.size() <= 3;
            if (!axisAlignedEnough && points.size() > 10) {
                return null;
            }
            return new RawDxfGeometryBox(entityType, layer, layoutName, minX, minY, maxX, maxY);
        }

        private boolean looksClosed() {
            if (points.size() < 4) {
                return false;
            }
            double[] first = points.get(0);
            double[] last = points.get(points.size() - 1);
            return Math.abs(first[0] - last[0]) <= 0.01d && Math.abs(first[1] - last[1]) <= 0.01d;
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }

        private Integer parseInteger(String value) {
            try {
                return Integer.parseInt(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private static class RawDxfVertexBuilder {
        private Double x;
        private Double y;

        private void accept(String code, String value) {
            if ("10".equals(code) && x == null) {
                x = parseDouble(value);
                return;
            }
            if ("20".equals(code) && y == null) {
                y = parseDouble(value);
            }
        }

        private Double x() {
            return x;
        }

        private Double y() {
            return y;
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private record RawDxfGeometryBox(
            String entityType,
            String layer,
            String layoutName,
            double minX,
            double minY,
            double maxX,
            double maxY
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

    public record DxfGeometryBox(
            int id,
            String entityType,
            String layer,
            String layoutName,
            double rawMinX,
            double rawMinY,
            double rawMaxX,
            double rawMaxY,
            int x,
            int y,
            int width,
            int height
    ) {
    }

    public record DxfParseResult(
            int canvasWidthPx,
            int canvasHeightPx,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes
    ) {
    }
}
