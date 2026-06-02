package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
            List<RawDxfLineEntity> rawLineEntities = extractLineEntities(lines);
            Map<String, RawDxfBlockDefinition> blockDefinitions = extractBlockDefinitions(lines);
            List<RawDxfGeometryBox> rawGeometryBoxes = new ArrayList<>();
            rawGeometryBoxes.addAll(extractGeometryBoxes(lines));
            rawGeometryBoxes.addAll(extractViewportBoxes(lines));
            rawGeometryBoxes.addAll(extractHatchBoxes(lines));
            rawGeometryBoxes.addAll(buildGeometryBoxesFromLines(rawLineEntities));
            rawGeometryBoxes.addAll(buildGeometryBoxesFromLineClusters(rawLineEntities));
            List<RawDxfInsertMarker> rawInsertMarkers = extractInsertMarkers(lines, blockDefinitions);
            rawGeometryBoxes.addAll(buildInsertedBlockGeometryBoxes(rawInsertMarkers));
            return normalize(rawTexts, deduplicateGeometryBoxes(rawGeometryBoxes), rawInsertMarkers);
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

    private List<RawDxfGeometryBox> extractViewportBoxes(List<String> lines) {
        List<RawDxfGeometryBox> results = new ArrayList<>();
        RawDxfViewportBuilder current = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (current != null) {
                    RawDxfGeometryBox box = current.buildBox();
                    if (box != null) {
                        results.add(box);
                    }
                }
                current = "VIEWPORT".equals(normalizeEntityType(value)) ? new RawDxfViewportBuilder() : null;
                continue;
            }
            if (current != null) {
                current.accept(code, value);
            }
        }
        if (current != null) {
            RawDxfGeometryBox box = current.buildBox();
            if (box != null) {
                results.add(box);
            }
        }
        return results;
    }

    private List<RawDxfLineEntity> extractLineEntities(List<String> lines) {
        List<RawDxfLineEntity> results = new ArrayList<>();
        RawDxfLineBuilder current = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (current != null) {
                    RawDxfLineEntity line = current.build();
                    if (line != null) {
                        results.add(line);
                    }
                }
                current = "LINE".equals(normalizeEntityType(value)) ? new RawDxfLineBuilder() : null;
                continue;
            }
            if (current != null) {
                current.accept(code, value);
            }
        }
        if (current != null) {
            RawDxfLineEntity line = current.build();
            if (line != null) {
                results.add(line);
            }
        }
        return results;
    }

    private List<RawDxfGeometryBox> buildGeometryBoxesFromLines(List<RawDxfLineEntity> lines) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<RawDxfLineEntity> horizontalLines = lines.stream()
                .filter(this::isHorizontalLine)
                .toList();
        List<RawDxfLineEntity> verticalLines = lines.stream()
                .filter(this::isVerticalLine)
                .toList();
        List<RawDxfGeometryBox> results = new ArrayList<>();
        for (int firstIndex = 0; firstIndex < horizontalLines.size(); firstIndex += 1) {
            RawDxfLineEntity topLine = horizontalLines.get(firstIndex);
            double topMinX = Math.min(topLine.x1(), topLine.x2());
            double topMaxX = Math.max(topLine.x1(), topLine.x2());
            for (int secondIndex = firstIndex + 1; secondIndex < horizontalLines.size(); secondIndex += 1) {
                RawDxfLineEntity bottomLine = horizontalLines.get(secondIndex);
                if (!sameGroup(topLine.layer(), bottomLine.layer()) || !sameGroup(topLine.layoutName(), bottomLine.layoutName())) {
                    continue;
                }
                double bottomMinX = Math.min(bottomLine.x1(), bottomLine.x2());
                double bottomMaxX = Math.max(bottomLine.x1(), bottomLine.x2());
                if (Math.abs(topMinX - bottomMinX) > 0.05d || Math.abs(topMaxX - bottomMaxX) > 0.05d) {
                    continue;
                }
                double minY = Math.min(topLine.y1(), bottomLine.y1());
                double maxY = Math.max(topLine.y1(), bottomLine.y1());
                if ((maxY - minY) < 1d || (topMaxX - topMinX) < 1d) {
                    continue;
                }
                boolean hasLeft = verticalLines.stream().anyMatch(line -> sameGroup(line.layer(), topLine.layer())
                        && sameGroup(line.layoutName(), topLine.layoutName())
                        && approximatelyEqual(line.x1(), topMinX)
                        && coversRange(Math.min(line.y1(), line.y2()), Math.max(line.y1(), line.y2()), minY, maxY));
                if (!hasLeft) {
                    continue;
                }
                boolean hasRight = verticalLines.stream().anyMatch(line -> sameGroup(line.layer(), topLine.layer())
                        && sameGroup(line.layoutName(), topLine.layoutName())
                        && approximatelyEqual(line.x1(), topMaxX)
                        && coversRange(Math.min(line.y1(), line.y2()), Math.max(line.y1(), line.y2()), minY, maxY));
                if (!hasRight) {
                    continue;
                }
                results.add(new RawDxfGeometryBox("LINE_RECT", topLine.layer(), topLine.layoutName(), topMinX, minY, topMaxX, maxY));
                if (results.size() >= 400) {
                    return deduplicateGeometryBoxes(results);
                }
            }
        }
        return deduplicateGeometryBoxes(results);
    }

    private List<RawDxfGeometryBox> extractHatchBoxes(List<String> lines) {
        List<RawDxfGeometryBox> results = new ArrayList<>();
        RawDxfHatchBuilder current = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (current != null) {
                    RawDxfGeometryBox box = current.buildBox();
                    if (box != null) {
                        results.add(box);
                    }
                }
                current = "HATCH".equals(normalizeEntityType(value)) ? new RawDxfHatchBuilder() : null;
                continue;
            }
            if (current != null) {
                current.accept(code, value);
            }
        }
        if (current != null) {
            RawDxfGeometryBox box = current.buildBox();
            if (box != null) {
                results.add(box);
            }
        }
        return results;
    }

    private List<RawDxfGeometryBox> buildGeometryBoxesFromLineClusters(List<RawDxfLineEntity> lines) {
        if (lines == null || lines.size() < 4) {
            return List.of();
        }
        List<RawDxfLineEntity> filtered = lines.stream()
                .filter(line -> line != null)
                .filter(line -> isHorizontalLine(line) || isVerticalLine(line))
                .limit(2000)
                .toList();
        boolean[] visited = new boolean[filtered.size()];
        List<RawDxfGeometryBox> results = new ArrayList<>();
        for (int index = 0; index < filtered.size(); index += 1) {
            if (visited[index]) {
                continue;
            }
            RawDxfLineEntity seed = filtered.get(index);
            List<RawDxfLineEntity> cluster = new ArrayList<>();
            cluster.add(seed);
            visited[index] = true;
            boolean changed = true;
            while (changed) {
                changed = false;
                for (int candidateIndex = 0; candidateIndex < filtered.size(); candidateIndex += 1) {
                    if (visited[candidateIndex]) {
                        continue;
                    }
                    RawDxfLineEntity candidate = filtered.get(candidateIndex);
                    if (!sameGroup(seed.layer(), candidate.layer()) || !sameGroup(seed.layoutName(), candidate.layoutName())) {
                        continue;
                    }
                    boolean linked = cluster.stream().anyMatch(existing -> areLinesConnected(existing, candidate));
                    if (linked) {
                        cluster.add(candidate);
                        visited[candidateIndex] = true;
                        changed = true;
                    }
                }
            }
            if (cluster.size() < 4) {
                continue;
            }
            RawDxfGeometryBox clusterBox = buildClusterBox(seed.layer(), seed.layoutName(), cluster);
            if (clusterBox != null) {
                results.add(clusterBox);
            }
        }
        return deduplicateGeometryBoxes(results);
    }

    private RawDxfGeometryBox buildClusterBox(String layer, String layoutName, List<RawDxfLineEntity> cluster) {
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (RawDxfLineEntity line : cluster) {
            minX = Math.min(minX, Math.min(line.x1(), line.x2()));
            maxX = Math.max(maxX, Math.max(line.x1(), line.x2()));
            minY = Math.min(minY, Math.min(line.y1(), line.y2()));
            maxY = Math.max(maxY, Math.max(line.y1(), line.y2()));
        }
        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
            return null;
        }
        if ((maxX - minX) < 1d || (maxY - minY) < 1d) {
            return null;
        }
        return new RawDxfGeometryBox("LINE_CLUSTER", layer, layoutName, minX, minY, maxX, maxY);
    }

    private boolean areLinesConnected(RawDxfLineEntity first, RawDxfLineEntity second) {
        return pointsClose(first.x1(), first.y1(), second.x1(), second.y1())
                || pointsClose(first.x1(), first.y1(), second.x2(), second.y2())
                || pointsClose(first.x2(), first.y2(), second.x1(), second.y1())
                || pointsClose(first.x2(), first.y2(), second.x2(), second.y2());
    }

    private boolean pointsClose(double x1, double y1, double x2, double y2) {
        return Math.abs(x1 - x2) <= 0.1d && Math.abs(y1 - y2) <= 0.1d;
    }

    private Map<String, RawDxfBlockDefinition> extractBlockDefinitions(List<String> lines) {
        Map<String, RawDxfBlockDefinition> definitions = new HashMap<>();
        boolean insideBlock = false;
        String currentBlockName = null;
        List<String> currentBlockLines = new ArrayList<>();
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                String entityType = normalizeEntityType(value);
                if ("BLOCK".equals(entityType)) {
                    insideBlock = true;
                    currentBlockName = null;
                    currentBlockLines = new ArrayList<>();
                    continue;
                }
                if (insideBlock && "ENDBLK".equals(entityType)) {
                    RawDxfBlockDefinition definition = buildBlockDefinition(currentBlockName, currentBlockLines);
                    if (definition != null) {
                        definitions.put(definition.name(), definition);
                    }
                    insideBlock = false;
                    currentBlockName = null;
                    currentBlockLines = new ArrayList<>();
                    continue;
                }
            }
            if (!insideBlock) {
                continue;
            }
            currentBlockLines.add(code);
            currentBlockLines.add(value);
            if ("2".equals(code) && !StringUtils.hasText(currentBlockName) && StringUtils.hasText(value)) {
                currentBlockName = value.trim();
            }
        }
        return definitions;
    }

    private RawDxfBlockDefinition buildBlockDefinition(String blockName, List<String> lines) {
        if (!StringUtils.hasText(blockName) || lines == null || lines.isEmpty()) {
            return null;
        }
        List<RawDxfTextEntity> blockTexts = extractTextEntities(lines);
        List<RawDxfLineEntity> blockLines = extractLineEntities(lines);
        List<RawDxfGeometryBox> geometries = new ArrayList<>();
        geometries.addAll(extractGeometryBoxes(lines));
        geometries.addAll(extractHatchBoxes(lines));
        geometries.addAll(buildGeometryBoxesFromLines(blockLines));
        geometries.addAll(buildGeometryBoxesFromLineClusters(blockLines));
        geometries = deduplicateGeometryBoxes(geometries);
        List<String> titleHints = blockTexts.stream()
                .map(RawDxfTextEntity::text)
                .map(this::normalizeText)
                .filter(StringUtils::hasText)
                .distinct()
                .limit(8)
                .toList();
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (RawDxfGeometryBox geometry : geometries) {
            minX = Math.min(minX, geometry.minX());
            maxX = Math.max(maxX, geometry.maxX());
            minY = Math.min(minY, geometry.minY());
            maxY = Math.max(maxY, geometry.maxY());
        }
        for (RawDxfTextEntity text : blockTexts) {
            minX = Math.min(minX, text.rawX());
            maxX = Math.max(maxX, text.rawX());
            minY = Math.min(minY, text.rawY());
            maxY = Math.max(maxY, text.rawY());
        }
        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
            minX = 0d;
            maxX = 1d;
            minY = 0d;
            maxY = 1d;
        }
        return new RawDxfBlockDefinition(blockName.trim(), titleHints, minX, minY, maxX, maxY);
    }

    private List<RawDxfInsertMarker> extractInsertMarkers(List<String> lines, Map<String, RawDxfBlockDefinition> blockDefinitions) {
        List<RawDxfInsertMarker> results = new ArrayList<>();
        RawDxfInsertBuilder current = null;
        for (int index = 0; index + 1 < lines.size(); index += 2) {
            String code = lines.get(index).trim();
            String value = lines.get(index + 1);
            if ("0".equals(code)) {
                if (current != null) {
                    RawDxfInsertMarker marker = current.build(blockDefinitions);
                    if (marker != null) {
                        results.add(marker);
                    }
                }
                current = "INSERT".equals(normalizeEntityType(value)) ? new RawDxfInsertBuilder() : null;
                continue;
            }
            if (current != null) {
                current.accept(code, value);
            }
        }
        if (current != null) {
            RawDxfInsertMarker marker = current.build(blockDefinitions);
            if (marker != null) {
                results.add(marker);
            }
        }
        return results;
    }

    private List<RawDxfGeometryBox> buildInsertedBlockGeometryBoxes(List<RawDxfInsertMarker> markers) {
        if (markers == null || markers.isEmpty()) {
            return List.of();
        }
        List<RawDxfGeometryBox> results = new ArrayList<>();
        for (RawDxfInsertMarker marker : markers) {
            if (marker == null || marker.blockMinX() == null || marker.blockMaxX() == null || marker.blockMinY() == null || marker.blockMaxY() == null) {
                continue;
            }
            double minX = marker.rawX() + (marker.blockMinX() * marker.scaleX());
            double maxX = marker.rawX() + (marker.blockMaxX() * marker.scaleX());
            double minY = marker.rawY() + (marker.blockMinY() * marker.scaleY());
            double maxY = marker.rawY() + (marker.blockMaxY() * marker.scaleY());
            if (maxX - minX < 1d || maxY - minY < 1d) {
                continue;
            }
            results.add(new RawDxfGeometryBox("INSERT_BLOCK", marker.layer(), marker.layoutName(), minX, minY, maxX, maxY));
        }
        return results;
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

    private DxfParseResult normalize(
            List<RawDxfTextEntity> rawTexts,
            List<RawDxfGeometryBox> rawGeometryBoxes,
            List<RawDxfInsertMarker> rawInsertMarkers
    ) {
        if (rawTexts.isEmpty() && rawGeometryBoxes.isEmpty() && rawInsertMarkers.isEmpty()) {
            return new DxfParseResult(1600, 900, List.of(), List.of(), List.of());
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
        for (RawDxfInsertMarker rawInsert : rawInsertMarkers) {
            minX = Math.min(minX, rawInsert.rawX());
            maxX = Math.max(maxX, rawInsert.rawX());
            minY = Math.min(minY, rawInsert.rawY());
            maxY = Math.max(maxY, rawInsert.rawY());
        }
        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
            return new DxfParseResult(1600, 900, List.of(), List.of(), List.of());
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
        List<DxfInsertMarker> insertMarkers = new ArrayList<>();
        int nextInsertId = 1;
        for (RawDxfInsertMarker rawInsert : rawInsertMarkers) {
            int x = normalizeAxis(rawInsert.rawX(), minX, rangeX, canvasWidth);
            int y = normalizeAxis(maxY - rawInsert.rawY(), 0d, rangeY, canvasHeight);
            insertMarkers.add(new DxfInsertMarker(
                    nextInsertId++,
                    rawInsert.blockName(),
                    rawInsert.titleHint(),
                    rawInsert.layer(),
                    rawInsert.layoutName(),
                    rawInsert.rawX(),
                    rawInsert.rawY(),
                    rawInsert.scaleX(),
                    rawInsert.scaleY(),
                    x,
                    y
            ));
        }
        return new DxfParseResult(canvasWidth, canvasHeight, labels, geometryBoxes, insertMarkers);
    }

    private boolean isHorizontalLine(RawDxfLineEntity line) {
        return line != null && approximatelyEqual(line.y1(), line.y2());
    }

    private boolean isVerticalLine(RawDxfLineEntity line) {
        return line != null && approximatelyEqual(line.x1(), line.x2());
    }

    private boolean approximatelyEqual(double first, double second) {
        return Math.abs(first - second) <= 0.05d;
    }

    private boolean sameGroup(String first, String second) {
        return normalizeValue(first).equals(normalizeValue(second));
    }

    private boolean coversRange(double lineMin, double lineMax, double targetMin, double targetMax) {
        return lineMin <= targetMin + 0.05d && lineMax >= targetMax - 0.05d;
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

    private static class RawDxfLineBuilder {
        private String layer;
        private String layoutName;
        private Double x1;
        private Double y1;
        private Double x2;
        private Double y2;

        private void accept(String code, String value) {
            if ("8".equals(code)) {
                layer = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("410".equals(code)) {
                layoutName = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("10".equals(code) && x1 == null) {
                x1 = parseDouble(value);
                return;
            }
            if ("20".equals(code) && y1 == null) {
                y1 = parseDouble(value);
                return;
            }
            if ("11".equals(code) && x2 == null) {
                x2 = parseDouble(value);
                return;
            }
            if ("21".equals(code) && y2 == null) {
                y2 = parseDouble(value);
            }
        }

        private RawDxfLineEntity build() {
            if (x1 == null || y1 == null || x2 == null || y2 == null) {
                return null;
            }
            return new RawDxfLineEntity(layer, layoutName, x1, y1, x2, y2);
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private static class RawDxfViewportBuilder {
        private String layer;
        private String layoutName;
        private Double centerX;
        private Double centerY;
        private Double width;
        private Double height;

        private void accept(String code, String value) {
            if ("8".equals(code)) {
                layer = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("410".equals(code)) {
                layoutName = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("10".equals(code) && centerX == null) {
                centerX = parseDouble(value);
                return;
            }
            if ("20".equals(code) && centerY == null) {
                centerY = parseDouble(value);
                return;
            }
            if ("41".equals(code) && width == null) {
                width = parseDouble(value);
                return;
            }
            if ("40".equals(code) && height == null) {
                height = parseDouble(value);
            }
        }

        private RawDxfGeometryBox buildBox() {
            if (centerX == null || centerY == null || width == null || height == null) {
                return null;
            }
            if (width <= 0d || height <= 0d) {
                return null;
            }
            double halfWidth = width / 2d;
            double halfHeight = height / 2d;
            return new RawDxfGeometryBox(
                    "VIEWPORT",
                    layer,
                    layoutName,
                    centerX - halfWidth,
                    centerY - halfHeight,
                    centerX + halfWidth,
                    centerY + halfHeight
            );
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private static class RawDxfInsertBuilder {
        private String blockName;
        private String layer;
        private String layoutName;
        private Double rawX;
        private Double rawY;
        private Double scaleX;
        private Double scaleY;

        private void accept(String code, String value) {
            if ("2".equals(code)) {
                blockName = StringUtils.hasText(value) ? value.trim() : null;
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
                return;
            }
            if ("41".equals(code) && scaleX == null) {
                scaleX = parseDouble(value);
                return;
            }
            if ("42".equals(code) && scaleY == null) {
                scaleY = parseDouble(value);
            }
        }

        private RawDxfInsertMarker build(Map<String, RawDxfBlockDefinition> blockDefinitions) {
            if (!StringUtils.hasText(blockName) || rawX == null || rawY == null) {
                return null;
            }
            RawDxfBlockDefinition definition = blockDefinitions != null ? blockDefinitions.get(blockName) : null;
            return new RawDxfInsertMarker(
                    blockName,
                    definition != null ? definition.primaryTitleHint() : null,
                    layer,
                    layoutName,
                    rawX,
                    rawY,
                    scaleX != null ? scaleX : 1d,
                    scaleY != null ? scaleY : 1d,
                    definition != null ? definition.minX() : null,
                    definition != null ? definition.minY() : null,
                    definition != null ? definition.maxX() : null,
                    definition != null ? definition.maxY() : null
            );
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private static class RawDxfHatchBuilder {
        private String layer;
        private String layoutName;
        private Double pendingX;
        private final List<double[]> points = new ArrayList<>();

        private void accept(String code, String value) {
            if ("8".equals(code)) {
                layer = StringUtils.hasText(value) ? value.trim() : null;
                return;
            }
            if ("410".equals(code)) {
                layoutName = StringUtils.hasText(value) ? value.trim() : null;
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

        private RawDxfGeometryBox buildBox() {
            if (points.size() < 3) {
                return null;
            }
            double minX = Double.POSITIVE_INFINITY;
            double maxX = Double.NEGATIVE_INFINITY;
            double minY = Double.POSITIVE_INFINITY;
            double maxY = Double.NEGATIVE_INFINITY;
            for (double[] point : points) {
                minX = Math.min(minX, point[0]);
                maxX = Math.max(maxX, point[0]);
                minY = Math.min(minY, point[1]);
                maxY = Math.max(maxY, point[1]);
            }
            if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
                return null;
            }
            if ((maxX - minX) < 1d || (maxY - minY) < 1d) {
                return null;
            }
            return new RawDxfGeometryBox("HATCH", layer, layoutName, minX, minY, maxX, maxY);
        }

        private Double parseDouble(String value) {
            try {
                return Double.parseDouble(value.trim());
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

    private record RawDxfLineEntity(
            String layer,
            String layoutName,
            double x1,
            double y1,
            double x2,
            double y2
    ) {
    }

    private record RawDxfInsertMarker(
            String blockName,
            String titleHint,
            String layer,
            String layoutName,
            double rawX,
            double rawY,
            double scaleX,
            double scaleY,
            Double blockMinX,
            Double blockMinY,
            Double blockMaxX,
            Double blockMaxY
    ) {
    }

    private record RawDxfBlockDefinition(
            String name,
            List<String> titleHints,
            double minX,
            double minY,
            double maxX,
            double maxY
    ) {
        private String primaryTitleHint() {
            return titleHints != null && !titleHints.isEmpty() ? titleHints.get(0) : null;
        }
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

    public record DxfInsertMarker(
            int id,
            String blockName,
            String titleHint,
            String layer,
            String layoutName,
            double rawX,
            double rawY,
            double scaleX,
            double scaleY,
            int x,
            int y
    ) {
    }

    public record DxfParseResult(
            int canvasWidthPx,
            int canvasHeightPx,
            List<DxfTextLabel> labels,
            List<DxfGeometryBox> geometryBoxes,
            List<DxfInsertMarker> insertMarkers
    ) {
    }
}
