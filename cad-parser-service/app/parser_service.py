from __future__ import annotations

import base64
import math
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

import ezdxf
from ezdxf import bbox as ezdxf_bbox

PARSER_RULESET_VERSION = "2026-06-03-title-material-filter-v2"


class CadParseError(Exception):
    pass


@dataclass
class Point:
    x: float
    y: float


@dataclass
class Bounds:
    min_x: float
    min_y: float
    max_x: float
    max_y: float

    @property
    def width(self) -> float:
        return max(0.0, self.max_x - self.min_x)

    @property
    def height(self) -> float:
        return max(0.0, self.max_y - self.min_y)

    @property
    def area(self) -> float:
        return self.width * self.height

    def is_valid(self) -> bool:
        return (
            math.isfinite(self.min_x)
            and math.isfinite(self.min_y)
            and math.isfinite(self.max_x)
            and math.isfinite(self.max_y)
            and self.max_x > self.min_x
            and self.max_y > self.min_y
        )

    def expand(self, dx: float, dy: float) -> "Bounds":
        return Bounds(self.min_x - dx, self.min_y - dy, self.max_x + dx, self.max_y + dy)

    def contains_point(self, point: Point) -> bool:
        return self.min_x <= point.x <= self.max_x and self.min_y <= point.y <= self.max_y

    def contains_bounds(self, other: "Bounds") -> bool:
        return (
            self.min_x <= other.min_x
            and self.min_y <= other.min_y
            and self.max_x >= other.max_x
            and self.max_y >= other.max_y
        )

    def intersects(self, other: "Bounds") -> bool:
        return (
            self.max_x >= other.min_x
            and self.min_x <= other.max_x
            and self.max_y >= other.min_y
            and self.min_y <= other.max_y
        )

    def to_dict(self) -> dict:
        return {
            "minX": round(self.min_x, 6),
            "minY": round(self.min_y, 6),
            "maxX": round(self.max_x, 6),
            "maxY": round(self.max_y, 6),
            "width": round(self.width, 6),
            "height": round(self.height, 6),
        }


@dataclass
class TextLabel:
    text: str
    point: Point
    char_height: float = 0.0


@dataclass
class LineSegment:
    start: Point
    end: Point
    layer: str = ""
    source_type: str = "LINE"

    @property
    def min_x(self) -> float:
        return min(self.start.x, self.end.x)

    @property
    def max_x(self) -> float:
        return max(self.start.x, self.end.x)

    @property
    def min_y(self) -> float:
        return min(self.start.y, self.end.y)

    @property
    def max_y(self) -> float:
        return max(self.start.y, self.end.y)

    @property
    def length(self) -> float:
        return math.dist((self.start.x, self.start.y), (self.end.x, self.end.y))

    def is_vertical(self) -> bool:
        return abs(self.start.x - self.end.x) <= max(40.0, abs(self.start.y - self.end.y) * 0.03)

    def is_horizontal(self) -> bool:
        return abs(self.start.y - self.end.y) <= max(40.0, abs(self.start.x - self.end.x) * 0.03)

    def spans_y(self, y: float, tolerance: float = 120.0) -> bool:
        return self.min_y - tolerance <= y <= self.max_y + tolerance

    def spans_x(self, x: float, tolerance: float = 120.0) -> bool:
        return self.min_x - tolerance <= x <= self.max_x + tolerance


@dataclass
class RoomCandidate:
    polygon: list[Point]
    bounds: Bounds
    source_type: str
    label: Optional[str] = None
    room_type: str = "room"

    def to_dict(self) -> dict:
        return {
            "name": self.label,
            "type": self.room_type,
            "bounds": self.bounds.to_dict(),
            "polygon": [{"x": round(point.x, 6), "y": round(point.y, 6)} for point in self.polygon],
        }


@dataclass
class DrawingCandidate:
    drawing_id: str
    title: str
    bounds: Bounds
    rooms: list[RoomCandidate] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "drawingId": self.drawing_id,
            "title": self.title,
            "previewUrl": build_preview_data_url(self),
            "bounds": self.bounds.to_dict(),
            "rooms": [room.to_dict() for room in self.rooms],
        }


def analyze_cad_file(file_path: Path) -> dict:
    prepared_path = prepare_input_file(file_path)
    try:
        document = ezdxf.readfile(prepared_path)
    except Exception as exc:
        raise CadParseError(f"Không thể đọc file CAD: {exc}") from exc

    modelspace = document.modelspace()
    text_labels = extract_text_labels(modelspace)
    line_segments = extract_line_segments(modelspace)
    drawing_frames = extract_drawing_frames(modelspace)
    room_candidates = extract_room_candidates(modelspace)
    if not room_candidates:
        raise CadParseError("Không tìm thấy vùng phòng/khu vực khép kín nào trong file CAD.")

    global_bounds = merge_bounds(candidate.bounds for candidate in room_candidates)
    log_entity_statistics(modelspace)
    log_parse_summary("raw", text_labels, room_candidates, global_bounds)
    room_candidates = filter_room_candidates(room_candidates, global_bounds)
    if not room_candidates:
        raise CadParseError("File CAD có vùng hình học nhưng không đủ rõ để suy ra phòng/khu vực.")

    assign_labels_and_types(room_candidates, text_labels, global_bounds)
    room_candidates = discard_noise_candidates(room_candidates, global_bounds)
    if not room_candidates:
        raise CadParseError("File CAD chỉ còn lại annotation/khung bao nhiễu sau khi lọc, chưa đủ để dựng mặt bằng.")
    log_parse_summary("filtered", text_labels, room_candidates, global_bounds)
    drawings = split_into_drawings(room_candidates, text_labels, line_segments, drawing_frames, global_bounds)
    if not drawings:
        raise CadParseError("Không thể tách file CAD thành bản vẽ con hợp lệ.")
    print(
        "[cad-parser] drawings=",
        [
            {
                "title": drawing.title,
                "rooms": len(drawing.rooms),
                "bounds": drawing.bounds.to_dict(),
            }
            for drawing in drawings
        ],
    )

    return {
        "drawings": [drawing.to_dict() for drawing in drawings],
    }


def prepare_input_file(file_path: Path) -> Path:
    suffix = file_path.suffix.lower()
    if suffix == ".dxf":
        return file_path
    if suffix != ".dwg":
        raise CadParseError("Chỉ hỗ trợ file DWG hoặc DXF.")

    oda_path = os.getenv("CAD_IMPORT_ODA_EXECUTABLE_PATH", "").strip()
    if not oda_path:
        raise CadParseError(
            "File DWG cần converter trước khi ezdxf đọc được. "
            "Hãy cài ODA File Converter rồi set CAD_IMPORT_ODA_EXECUTABLE_PATH, "
            "hoặc thử xuất file sang DXF để test nhanh."
        )
    return convert_dwg_to_dxf(file_path, oda_path)


def convert_dwg_to_dxf(file_path: Path, oda_path: str) -> Path:
    executable = Path(oda_path).expanduser()
    if not executable.exists():
        raise CadParseError("Không tìm thấy ODA File Converter theo đường dẫn đã cấu hình.")

    temp_root = Path(tempfile.mkdtemp(prefix="cad-parser-"))
    input_dir = temp_root / "input"
    output_dir = temp_root / "output"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    copied_input = input_dir / file_path.name
    shutil.copy2(file_path, copied_input)

    command = [
        str(executable),
        str(input_dir),
        str(output_dir),
        "ACAD2018",
        "DXF",
        "0",
        "1",
        file_path.name,
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise CadParseError(f"ODA File Converter chạy lỗi: {stderr or exc}") from exc

    dxf_candidates = list(output_dir.rglob("*.dxf"))
    if not dxf_candidates:
        raise CadParseError("ODA File Converter không tạo ra file DXF đầu ra.")
    return dxf_candidates[0]


def extract_text_labels(layout) -> list[TextLabel]:
    labels: list[TextLabel] = []
    for entity in layout:
        dxftype = entity.dxftype()
        try:
            if dxftype == "TEXT":
                text = clean_text(getattr(entity.dxf, "text", ""))
                if text:
                    labels.append(
                        TextLabel(
                            text=text,
                            point=Point(float(entity.dxf.insert.x), float(entity.dxf.insert.y)),
                            char_height=float(getattr(entity.dxf, "height", 0.0) or 0.0),
                        )
                    )
            elif dxftype == "MTEXT":
                text = clean_text(entity.plain_text())
                if text:
                    insert = entity.dxf.insert
                    labels.append(
                        TextLabel(
                            text=text,
                            point=Point(float(insert.x), float(insert.y)),
                            char_height=float(getattr(entity.dxf, "char_height", 0.0) or 0.0),
                        )
                    )
            elif dxftype == "ATTRIB":
                text = clean_text(getattr(entity.dxf, "text", ""))
                if text:
                    labels.append(
                        TextLabel(
                            text=text,
                            point=Point(float(entity.dxf.insert.x), float(entity.dxf.insert.y)),
                            char_height=float(getattr(entity.dxf, "height", 0.0) or 0.0),
                        )
                    )
        except Exception:
            continue
    return labels


def extract_room_candidates(layout) -> list[RoomCandidate]:
    candidates: list[RoomCandidate] = []
    for entity in layout:
        dxftype = entity.dxftype()
        try:
            if dxftype == "LWPOLYLINE":
                candidate = candidate_from_lwpolyline(entity)
            elif dxftype == "POLYLINE":
                candidate = candidate_from_polyline(entity)
            elif dxftype == "HATCH":
                candidate = candidate_from_generic_bbox(entity, "HATCH")
            elif dxftype == "CIRCLE":
                candidate = candidate_from_circle(entity)
            elif dxftype == "ELLIPSE":
                candidate = candidate_from_generic_bbox(entity, "ELLIPSE")
            else:
                candidate = None
        except Exception:
            candidate = None

        if candidate and candidate.bounds.is_valid():
            candidates.append(candidate)
    return deduplicate_candidates(candidates)


def extract_line_segments(layout) -> list[LineSegment]:
    segments: list[LineSegment] = []
    for entity in layout:
        dxftype = entity.dxftype()
        try:
            layer = getattr(entity.dxf, "layer", "") or ""
            if dxftype == "LINE":
                segments.append(
                    LineSegment(
                        start=Point(float(entity.dxf.start.x), float(entity.dxf.start.y)),
                        end=Point(float(entity.dxf.end.x), float(entity.dxf.end.y)),
                        layer=layer,
                        source_type="LINE",
                    )
                )
            elif dxftype == "LWPOLYLINE":
                points = [Point(float(x), float(y)) for x, y, *_ in entity.get_points("xy")]
                segments.extend(segments_from_points(points, layer, "LWPOLYLINE", entity.closed))
            elif dxftype == "POLYLINE":
                points = [Point(float(vertex.dxf.location.x), float(vertex.dxf.location.y)) for vertex in entity.vertices]
                segments.extend(segments_from_points(points, layer, "POLYLINE", entity.is_closed))
        except Exception:
            continue
    return [segment for segment in segments if segment.length >= 120.0]


def segments_from_points(points: list[Point], layer: str, source_type: str, closed: bool) -> list[LineSegment]:
    if len(points) < 2:
        return []
    pairs = list(zip(points, points[1:]))
    if closed and len(points) >= 3:
        pairs.append((points[-1], points[0]))
    return [LineSegment(start=start, end=end, layer=layer, source_type=source_type) for start, end in pairs]


def extract_drawing_frames(layout) -> list[Bounds]:
    frame_candidates: list[Bounds] = []
    for entity in layout:
        dxftype = entity.dxftype()
        if dxftype not in {"LWPOLYLINE", "POLYLINE"}:
            continue
        try:
            layer = normalize_text(getattr(entity.dxf, "layer", "") or "")
            is_closed = (dxftype == "LWPOLYLINE" and entity.closed) or (dxftype == "POLYLINE" and entity.is_closed)
            if not is_closed:
                continue
            if not any(token in layer for token in ["tpl bound", "bound", "khung bao"]):
                continue
            frame_candidate = candidate_from_generic_bbox(entity, "FRAME")
            if not frame_candidate:
                continue
            bounds = frame_candidate.bounds
            if bounds.width < 15000 or bounds.height < 10000:
                continue
            frame_candidates.append(bounds)
        except Exception:
            continue
    return deduplicate_bounds(frame_candidates)


def candidate_from_lwpolyline(entity) -> Optional[RoomCandidate]:
    if not entity.closed:
        return None
    points = [Point(float(x), float(y)) for x, y, *_ in entity.get_points("xy")]
    return build_candidate_from_polygon(points, "LWPOLYLINE")


def candidate_from_polyline(entity) -> Optional[RoomCandidate]:
    if not entity.is_closed:
        return None
    points = [Point(float(vertex.dxf.location.x), float(vertex.dxf.location.y)) for vertex in entity.vertices]
    return build_candidate_from_polygon(points, "POLYLINE")


def candidate_from_circle(entity) -> Optional[RoomCandidate]:
    center = entity.dxf.center
    radius = float(entity.dxf.radius)
    if radius <= 0:
        return None
    points: list[Point] = []
    for index in range(24):
        angle = (2 * math.pi * index) / 24
        points.append(Point(float(center.x + radius * math.cos(angle)), float(center.y + radius * math.sin(angle))))
    return build_candidate_from_polygon(points, "CIRCLE")


def candidate_from_generic_bbox(entity, source_type: str) -> Optional[RoomCandidate]:
    try:
        entity_bbox = ezdxf_bbox.extents([entity])
    except Exception:
        return None
    if entity_bbox is None:
        return None
    bounds = Bounds(
        float(entity_bbox.extmin.x),
        float(entity_bbox.extmin.y),
        float(entity_bbox.extmax.x),
        float(entity_bbox.extmax.y),
    )
    if not bounds.is_valid():
        return None
    polygon = rectangle_polygon(bounds)
    return RoomCandidate(polygon=polygon, bounds=bounds, source_type=source_type)


def build_candidate_from_polygon(points: list[Point], source_type: str) -> Optional[RoomCandidate]:
    if len(points) < 3:
        return None
    bounds = merge_bounds(Bounds(point.x, point.y, point.x, point.y) for point in points)
    if not bounds or not bounds.is_valid():
        return None
    if polygon_area(points) <= 0:
        return None
    return RoomCandidate(polygon=points, bounds=bounds, source_type=source_type)


def polygon_area(points: list[Point]) -> float:
    area = 0.0
    for index in range(len(points)):
        current = points[index]
        nxt = points[(index + 1) % len(points)]
        area += current.x * nxt.y - nxt.x * current.y
    return abs(area) / 2.0


def deduplicate_candidates(candidates: list[RoomCandidate]) -> list[RoomCandidate]:
    deduped: list[RoomCandidate] = []
    for candidate in sorted(candidates, key=lambda item: item.bounds.area, reverse=True):
        duplicate = False
        for existing in deduped:
            if are_bounds_similar(candidate.bounds, existing.bounds):
                duplicate = True
                break
        if not duplicate:
            deduped.append(candidate)
    return deduped


def deduplicate_bounds(bounds_list: list[Bounds]) -> list[Bounds]:
    deduped: list[Bounds] = []
    for bounds in sorted(bounds_list, key=lambda item: item.area, reverse=True):
        duplicate = False
        for existing in deduped:
            if are_bounds_similar(bounds, existing):
                duplicate = True
                break
        if not duplicate:
            deduped.append(bounds)
    return deduped


def are_bounds_similar(left: Bounds, right: Bounds) -> bool:
    tolerance_x = max(10.0, min(left.width, right.width) * 0.1)
    tolerance_y = max(10.0, min(left.height, right.height) * 0.1)
    return (
        abs(left.min_x - right.min_x) <= tolerance_x
        and abs(left.max_x - right.max_x) <= tolerance_x
        and abs(left.min_y - right.min_y) <= tolerance_y
        and abs(left.max_y - right.max_y) <= tolerance_y
    )


def filter_room_candidates(candidates: list[RoomCandidate], global_bounds: Bounds) -> list[RoomCandidate]:
    filtered: list[RoomCandidate] = []
    min_width = max(300.0, global_bounds.width * 0.012)
    min_height = max(300.0, global_bounds.height * 0.012)
    max_area = global_bounds.area * 0.85
    for candidate in candidates:
        if candidate.bounds.width < min_width or candidate.bounds.height < min_height:
            continue
        if candidate.bounds.area > max_area:
            continue
        filtered.append(candidate)
    return filtered


def assign_labels_and_types(candidates: list[RoomCandidate], labels: list[TextLabel], global_bounds: Bounds) -> None:
    proximity = max(global_bounds.width, global_bounds.height) * 0.04
    for index, candidate in enumerate(candidates, start=1):
        label = find_best_label(candidate, labels, proximity)
        candidate.label = label.text if label else f"Khu vực {index}"
        candidate.room_type = classify_room_type(candidate.label, candidate.bounds)


def discard_noise_candidates(candidates: list[RoomCandidate], global_bounds: Bounds) -> list[RoomCandidate]:
    if not candidates:
        return []

    filtered: list[RoomCandidate] = []
    for candidate in candidates:
        label = candidate.label or ""
        normalized = normalize_text(label)
        if is_non_plan_annotation(normalized):
            continue
        if candidate.room_type == "wall" and candidate.bounds.area > global_bounds.area * 0.03:
            continue
        filtered.append(candidate)

    refined: list[RoomCandidate] = []
    for candidate in filtered:
        contained_count = 0
        for other in filtered:
            if candidate is other:
                continue
            if candidate.bounds.contains_bounds(other.bounds) and other.bounds.area <= candidate.bounds.area * 0.8:
                contained_count += 1
        unlabeled = not candidate.label or normalize_text(candidate.label).startswith("khu vuc ")
        if contained_count >= 2 and (unlabeled or candidate.bounds.area > global_bounds.area * 0.12):
            continue
        refined.append(candidate)

    return refined


def find_best_label(candidate: RoomCandidate, labels: list[TextLabel], proximity: float) -> Optional[TextLabel]:
    inside_labels = [label for label in labels if candidate.bounds.contains_point(label.point) and looks_like_room_text(label.text)]
    if inside_labels:
        return sorted(
            inside_labels,
            key=lambda label: (-label.char_height, label.text),
        )[0]

    nearby_labels: list[tuple[float, TextLabel]] = []
    center = Point((candidate.bounds.min_x + candidate.bounds.max_x) / 2.0, (candidate.bounds.min_y + candidate.bounds.max_y) / 2.0)
    for label in labels:
        if not looks_like_room_text(label.text):
            continue
        distance = math.dist((center.x, center.y), (label.point.x, label.point.y))
        if distance <= proximity:
            nearby_labels.append((distance, label))
    if nearby_labels:
        nearby_labels.sort(key=lambda item: (item[0], -item[1].char_height))
        return nearby_labels[0][1]
    return None


def looks_like_room_text(text: str) -> bool:
    normalized = normalize_text(text)
    if not normalized:
        return False
    if len(normalized) <= 1:
        return False
    if "mat bang" in normalized:
        return False
    if re.fullmatch(r"[0-9./-]+", normalized):
        return False
    if is_non_plan_annotation(normalized):
        return False
    if is_material_or_area_text(normalized):
        return False
    return True


def classify_room_type(label: str, bounds: Bounds) -> str:
    normalized = normalize_text(label)
    if is_material_or_area_text(normalized):
        return "wall"
    if any(token in normalized for token in ["via he", "san", "cong", "ngoai troi"]):
        return "road"
    if any(token in normalized for token in ["hanh lang", "corridor", "hallway", "sanh"]):
        return "corridor"
    if any(token in normalized for token in ["cau thang", "stair", "thang bo", "staircase"]):
        return "staircase"
    if any(token in normalized for token in ["thang may", "elevator", "lift"]):
        return "elevator"
    if any(token in normalized for token in ["wc", "toilet", "ve sinh", "restroom"]):
        return "wc"
    if any(token in normalized for token in ["tuong", "wall", "vach"]):
        return "wall"
    if any(token in normalized for token in ["duong", "road", "street", "driveway"]):
        return "road"
    if bounds.width <= 400 or bounds.height <= 400:
        return "wall"
    return "room"


def split_into_drawings(
    candidates: list[RoomCandidate],
    labels: list[TextLabel],
    line_segments: list[LineSegment],
    drawing_frames: list[Bounds],
    global_bounds: Bounds,
) -> list[DrawingCandidate]:
    frame_based = split_drawings_by_title_frames(candidates, labels, line_segments, drawing_frames, global_bounds)
    if frame_based:
        return frame_based
    title_based = split_drawings_by_floor_titles(candidates, labels, global_bounds)
    if title_based:
        return title_based

    gap_x = max(global_bounds.width * 0.03, 400.0)
    gap_y = max(global_bounds.height * 0.04, 400.0)
    remaining = set(range(len(candidates)))
    clusters: list[list[RoomCandidate]] = []

    while remaining:
        start = remaining.pop()
        component = [start]
        queue = [start]
        while queue:
            current = queue.pop(0)
            current_bounds = candidates[current].bounds.expand(gap_x, gap_y)
            neighbors = []
            for candidate_index in list(remaining):
                if current_bounds.intersects(candidates[candidate_index].bounds):
                    neighbors.append(candidate_index)
                    remaining.remove(candidate_index)
            queue.extend(neighbors)
            component.extend(neighbors)
        clusters.append([candidates[index] for index in component])

    drawings: list[DrawingCandidate] = []
    for index, cluster in enumerate(sorted(clusters, key=lambda group: (merge_bounds(item.bounds for item in group).min_y, merge_bounds(item.bounds for item in group).min_x)), start=1):
        bounds = merge_bounds(item.bounds for item in cluster)
        if not bounds or not bounds.is_valid():
            continue
        title = choose_drawing_title(index, bounds, labels)
        cluster.sort(key=lambda item: (item.bounds.min_y, item.bounds.min_x))
        drawings.append(
            DrawingCandidate(
                drawing_id=f"drawing-{index}",
                title=title,
                bounds=bounds,
                rooms=cluster,
            )
        )
    return drawings


def split_drawings_by_title_frames(
    candidates: list[RoomCandidate],
    labels: list[TextLabel],
    line_segments: list[LineSegment],
    drawing_frames: list[Bounds],
    global_bounds: Bounds,
) -> list[DrawingCandidate]:
    floor_titles = deduplicate_floor_titles([label for label in labels if is_floor_plan_title(label.text)])
    if not floor_titles or not drawing_frames:
        return []

    sorted_titles = sorted(floor_titles, key=lambda item: item.point.y, reverse=True)
    used_frame_ids: set[int] = set()
    drawings: list[DrawingCandidate] = []

    print(
        "[cad-parser] drawing_frames=",
        [frame.to_dict() for frame in sorted(drawing_frames, key=lambda item: (item.min_y, item.min_x), reverse=True)[:12]],
    )

    for index, title in enumerate(sorted_titles, start=1):
        frame = find_matching_frame_for_title(title, drawing_frames, used_frame_ids)
        if not frame:
            print("[cad-parser] title_frame_match=", {"title": title.text, "frame": None})
            continue
        used_frame_ids.add(id(frame))
        frame_inner = inset_bounds(frame, frame.width * 0.012, frame.height * 0.04, frame.width * 0.012, frame.height * 0.02)
        base_rooms = [
            candidate
            for candidate in candidates
            if frame_inner.intersects(candidate.bounds) or frame.contains_point(bounds_center(candidate.bounds))
        ]
        inferred_rooms = infer_room_candidates_from_labels_and_lines(labels, line_segments, frame_inner, global_bounds)
        merged_rooms = merge_drawing_rooms(base_rooms, inferred_rooms)
        print(
            "[cad-parser] title_frame_match=",
            {
                "title": title.text,
                "frame": frame.to_dict(),
                "baseRooms": len(base_rooms),
                "inferredRooms": len(inferred_rooms),
                "mergedRooms": len(merged_rooms),
            },
        )
        if len(merged_rooms) < 1:
            continue
        drawings.append(
            DrawingCandidate(
                drawing_id=f"drawing-{index}",
                title=title.text,
                bounds=frame,
                rooms=merged_rooms,
            )
        )

    return drawings


def split_drawings_by_floor_titles(candidates: list[RoomCandidate], labels: list[TextLabel], global_bounds: Bounds) -> list[DrawingCandidate]:
    floor_titles = deduplicate_floor_titles([label for label in labels if is_floor_plan_title(label.text)])
    if not floor_titles:
        return []

    sorted_titles = sorted(floor_titles, key=lambda item: item.point.y, reverse=True)
    print(
        "[cad-parser] floor_titles=",
        [{"text": label.text, "x": round(label.point.x, 2), "y": round(label.point.y, 2)} for label in sorted_titles[:10]],
    )
    used_candidate_ids: set[int] = set()
    drawings: list[DrawingCandidate] = []
    vertical_tolerance = max(global_bounds.height * 0.02, 250.0)

    for index, title in enumerate(sorted_titles, start=1):
        upper_y = math.inf if index == 1 else (sorted_titles[index - 2].point.y + title.point.y) / 2.0
        lower_y = -math.inf if index == len(sorted_titles) else (title.point.y + sorted_titles[index].point.y) / 2.0
        assigned_rooms: list[RoomCandidate] = []
        for candidate in candidates:
            if id(candidate) in used_candidate_ids:
                continue
            center_x = (candidate.bounds.min_x + candidate.bounds.max_x) / 2.0
            center_y = (candidate.bounds.min_y + candidate.bounds.max_y) / 2.0
            if center_y < title.point.y - vertical_tolerance:
                continue
            if center_y >= upper_y + vertical_tolerance:
                continue
            if center_y <= lower_y - vertical_tolerance:
                continue
            assigned_rooms.append(candidate)

        if not assigned_rooms:
            continue
        if len(assigned_rooms) < 2:
            continue

        for candidate in assigned_rooms:
            used_candidate_ids.add(id(candidate))

        bounds = merge_bounds(item.bounds for item in assigned_rooms)
        if not bounds or not bounds.is_valid():
            continue
        assigned_rooms.sort(key=lambda item: (item.bounds.min_y, item.bounds.min_x))
        drawings.append(
            DrawingCandidate(
                drawing_id=f"drawing-{index}",
                title=title.text,
                bounds=bounds,
                rooms=assigned_rooms,
            )
        )

    return drawings


def find_matching_frame_for_title(title: TextLabel, drawing_frames: list[Bounds], used_frame_ids: set[int]) -> Optional[Bounds]:
    matches: list[tuple[float, Bounds]] = []
    for frame in drawing_frames:
        if id(frame) in used_frame_ids:
            continue
        if frame.contains_point(title.point):
            score = frame.area
            matches.append((score, frame))
            continue
        horizontal_match = frame.min_x <= title.point.x <= frame.max_x
        vertical_distance = min(abs(title.point.y - frame.min_y), abs(title.point.y - frame.max_y))
        if horizontal_match and vertical_distance <= max(frame.height * 0.18, 1200.0):
            score = vertical_distance + frame.area * 0.000001
            matches.append((score, frame))
    if not matches:
        return None
    matches.sort(key=lambda item: item[0])
    return matches[0][1]


def infer_room_candidates_from_labels_and_lines(
    labels: list[TextLabel],
    line_segments: list[LineSegment],
    frame_bounds: Bounds,
    global_bounds: Bounds,
) -> list[RoomCandidate]:
    structural_segments = [
        segment
        for segment in line_segments
        if is_structural_layer(segment.layer)
        and frame_bounds.intersects(Bounds(segment.min_x, segment.min_y, segment.max_x, segment.max_y))
    ]
    if not structural_segments:
        return []

    inferred: list[RoomCandidate] = []
    for label in labels:
        if not frame_bounds.contains_point(label.point):
            continue
        if not looks_like_room_text(label.text):
            continue
        candidate = infer_candidate_from_label_and_lines(label, structural_segments, frame_bounds, global_bounds)
        if candidate:
            inferred.append(candidate)
    return deduplicate_candidates(inferred)


def infer_candidate_from_label_and_lines(
    label: TextLabel,
    line_segments: list[LineSegment],
    frame_bounds: Bounds,
    global_bounds: Bounds,
) -> Optional[RoomCandidate]:
    corridor_y = max(frame_bounds.height * 0.16, 2600.0)
    corridor_x = max(frame_bounds.width * 0.08, 2200.0)

    vertical_segments = [
        segment
        for segment in line_segments
        if segment.is_vertical()
        and segment.max_x >= frame_bounds.min_x
        and segment.min_x <= frame_bounds.max_x
        and segment.max_y >= label.point.y - corridor_y
        and segment.min_y <= label.point.y + corridor_y
    ]
    horizontal_segments = [
        segment
        for segment in line_segments
        if segment.is_horizontal()
        and segment.max_y >= frame_bounds.min_y
        and segment.min_y <= frame_bounds.max_y
        and segment.max_x >= label.point.x - corridor_x
        and segment.min_x <= label.point.x + corridor_x
    ]

    left_candidates = [segment.max_x for segment in vertical_segments if segment.max_x < label.point.x]
    right_candidates = [segment.min_x for segment in vertical_segments if segment.min_x > label.point.x]
    bottom_candidates = [segment.max_y for segment in horizontal_segments if segment.max_y < label.point.y]
    top_candidates = [segment.min_y for segment in horizontal_segments if segment.min_y > label.point.y]

    if not left_candidates:
        left_candidates = [frame_bounds.min_x]
    if not right_candidates:
        right_candidates = [frame_bounds.max_x]
    if not bottom_candidates:
        bottom_candidates = [frame_bounds.min_y]
    if not top_candidates:
        top_candidates = [frame_bounds.max_y]

    if not left_candidates or not right_candidates or not bottom_candidates or not top_candidates:
        return None

    bounds = Bounds(max(left_candidates), max(bottom_candidates), min(right_candidates), min(top_candidates))
    if not bounds.is_valid():
        return None
    if bounds.width < 1200.0 or bounds.height < 1000.0:
        return None
    if bounds.width > frame_bounds.width * 0.75 or bounds.height > frame_bounds.height * 0.75:
        return None
    if bounds.area > global_bounds.area * 0.12:
        return None
    polygon = rectangle_polygon(bounds)
    candidate = RoomCandidate(polygon=polygon, bounds=bounds, source_type="LINE_INFERRED", label=label.text)
    candidate.room_type = classify_room_type(label.text, bounds)
    return candidate


def merge_drawing_rooms(base_rooms: list[RoomCandidate], inferred_rooms: list[RoomCandidate]) -> list[RoomCandidate]:
    merged: list[RoomCandidate] = []
    inferred_labels = {normalize_text(candidate.label or "") for candidate in inferred_rooms}

    for candidate in inferred_rooms:
        merged.append(candidate)

    for candidate in base_rooms:
        normalized_label = normalize_text(candidate.label or "")
        if candidate.source_type == "HATCH" and normalized_label.startswith("khu vuc ") and inferred_rooms:
            continue
        if any(are_bounds_similar(candidate.bounds, existing.bounds) for existing in merged):
            continue
        if normalized_label and normalized_label in inferred_labels and any(
            candidate.bounds.contains_bounds(existing.bounds) or existing.bounds.contains_bounds(candidate.bounds)
            for existing in merged
        ):
            continue
        merged.append(candidate)

    merged.sort(key=lambda item: (item.bounds.min_y, item.bounds.min_x))
    return merged


def bounds_center(bounds: Bounds) -> Point:
    return Point((bounds.min_x + bounds.max_x) / 2.0, (bounds.min_y + bounds.max_y) / 2.0)


def inset_bounds(bounds: Bounds, left: float, bottom: float, right: float, top: float) -> Bounds:
    return Bounds(
        bounds.min_x + left,
        bounds.min_y + bottom,
        bounds.max_x - right,
        bounds.max_y - top,
    )


def deduplicate_floor_titles(labels: list[TextLabel]) -> list[TextLabel]:
    deduped: list[TextLabel] = []
    for label in sorted(labels, key=lambda item: (-item.char_height, -item.point.y, item.point.x)):
        duplicate = False
        for existing in deduped:
            same_text = normalize_text(existing.text) == normalize_text(label.text)
            close_x = abs(existing.point.x - label.point.x) <= 600.0
            close_y = abs(existing.point.y - label.point.y) <= 600.0
            if same_text and close_x and close_y:
                duplicate = True
                break
        if not duplicate:
            deduped.append(label)
    return deduped


def choose_drawing_title(index: int, bounds: Bounds, labels: list[TextLabel]) -> str:
    search_zone = bounds.expand(bounds.width * 0.15, max(bounds.height * 0.25, 800.0))
    title_candidates: list[TextLabel] = []
    for label in labels:
        if not search_zone.contains_point(label.point):
            continue
        normalized = normalize_text(label.text)
        if any(token in normalized for token in ["mat bang", "tang", "floor", "level", "layout"]):
            title_candidates.append(label)
    if title_candidates:
        title_candidates.sort(key=lambda item: (-item.char_height, item.point.y))
        return title_candidates[0].text
    return f"Bản vẽ {index}"


def build_preview_data_url(drawing: DrawingCandidate) -> str:
    view_width = max(drawing.bounds.width, 1.0)
    view_height = max(drawing.bounds.height, 1.0)
    width_px = 900
    height_px = max(320, int((view_height / view_width) * width_px))
    scale = min((width_px - 40) / view_width, (height_px - 40) / view_height)
    margin = 20

    def map_point(point: Point) -> tuple[float, float]:
        x = margin + (point.x - drawing.bounds.min_x) * scale
        y = margin + (drawing.bounds.max_y - point.y) * scale
        return x, y

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width_px}" height="{height_px}" viewBox="0 0 {width_px} {height_px}">',
        '<rect width="100%" height="100%" fill="#f8fafc" />',
    ]

    for room in drawing.rooms:
        polygon_points = room.polygon or rectangle_polygon(room.bounds)
        mapped_points = [map_point(point) for point in polygon_points]
        points_attr = " ".join(f"{x:.2f},{y:.2f}" for x, y in mapped_points)
        svg_parts.append(
            f'<polygon points="{points_attr}" fill="{color_for_room_type(room.room_type)}33" stroke="{color_for_room_type(room.room_type)}" stroke-width="1.5" />'
        )
        center = Point((room.bounds.min_x + room.bounds.max_x) / 2.0, (room.bounds.min_y + room.bounds.max_y) / 2.0)
        center_x, center_y = map_point(center)
        svg_parts.append(
            f'<text x="{center_x:.2f}" y="{center_y:.2f}" text-anchor="middle" fill="#0f172a" font-size="12" font-family="Arial, sans-serif">{escape_xml(room.label or room.room_type)}</text>'
        )

    svg_parts.append("</svg>")
    svg = "".join(svg_parts)
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def color_for_room_type(room_type: str) -> str:
    return {
        "room": "#f97316",
        "corridor": "#94a3b8",
        "staircase": "#f59e0b",
        "elevator": "#8b5cf6",
        "wc": "#38bdf8",
        "wall": "#64748b",
        "road": "#52525b",
    }.get(room_type, "#f97316")


def rectangle_polygon(bounds: Bounds) -> list[Point]:
    return [
        Point(bounds.min_x, bounds.min_y),
        Point(bounds.max_x, bounds.min_y),
        Point(bounds.max_x, bounds.max_y),
        Point(bounds.min_x, bounds.max_y),
    ]


def merge_bounds(bounds_iterable: Iterable[Bounds]) -> Bounds:
    bounds_list = [bounds for bounds in bounds_iterable if bounds and bounds.is_valid()]
    if not bounds_list:
        return None
    return Bounds(
        min(bounds.min_x for bounds in bounds_list),
        min(bounds.min_y for bounds in bounds_list),
        max(bounds.max_x for bounds in bounds_list),
        max(bounds.max_y for bounds in bounds_list),
    )


def clean_text(value: str) -> str:
    text = (value or "")
    text = re.sub(r"%%[A-Za-z]", "", text)
    text = text.replace("\\P", " ").replace("\n", " ").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_text(value: str) -> str:
    text = clean_text(value).lower().replace("đ", "d")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_floor_plan_title(text: str) -> bool:
    normalized = normalize_text(text)
    if not normalized:
        return False
    has_floor_keyword = any(token in normalized for token in ["mat bang", "floor plan", "mb tang", "matbang"])
    has_level_keyword = any(token in normalized for token in ["tang", "floor", "level", "lau", "tum", "mai", "ret", "ham"])
    if not has_floor_keyword or not has_level_keyword:
        return False
    blocked_title_tokens = [
        "kich thuoc",
        "hoan thien",
        "lat gach",
        "op lat",
        "tuong",
        "tran",
        "ct1",
        "chi tiet",
        "mat cat",
        "mat dung",
    ]
    if any(token in normalized for token in blocked_title_tokens):
        return False
    if is_non_plan_annotation(normalized):
        return False
    return True


def is_non_plan_annotation(normalized_text: str) -> bool:
    if not normalized_text:
        return False
    blocked_tokens = [
        "mat cat",
        "mat dung",
        "chi tiet",
        "truc",
        "ky hieu",
        "ghi chu",
        "thong ke",
        "cua so",
        "cau tao",
        "dinh vi",
        "cong trinh",
        "section",
        "elevation",
        "detail",
    ]
    return any(token in normalized_text for token in blocked_tokens)


def is_material_or_area_text(normalized_text: str) -> bool:
    if not normalized_text:
        return False
    if normalized_text.startswith("s ") or normalized_text.startswith("s=") or normalized_text.startswith("dien tich"):
        return True
    material_tokens = [
        "san go",
        "gach",
        "da den",
        "da kim sa",
        "van da",
        "op lat",
        "hoan thien",
        "granite",
        "ceramic",
        "800x800",
        "600x600",
    ]
    return any(token in normalized_text for token in material_tokens)


def is_structural_layer(layer_name: str) -> bool:
    normalized = normalize_text(layer_name)
    if not normalized:
        return True
    blocked_tokens = [
        "dim",
        "kich thuoc",
        "text",
        "ghi chu",
        "hatch",
        "ky hieu",
        "truc",
        "bound",
        "khung",
        "defpoints",
    ]
    if any(token in normalized for token in blocked_tokens):
        return False
    preferred_tokens = [
        "tuong",
        "be tong",
        "cua",
        "thay",
        "hp thay",
        "vat dung",
        "net thay",
    ]
    return any(token in normalized for token in preferred_tokens) or normalized in {"0", "8"}


def log_parse_summary(stage: str, labels: list[TextLabel], candidates: list[RoomCandidate], global_bounds: Bounds) -> None:
    floor_title_samples = [label.text for label in labels if is_floor_plan_title(label.text)]
    print(
        f"[cad-parser] ruleset={PARSER_RULESET_VERSION} stage={stage} labels={len(labels)} candidates={len(candidates)} "
        f"bounds={global_bounds.to_dict() if global_bounds else None}"
    )
    if floor_title_samples:
        print("[cad-parser] floor_title_samples=", floor_title_samples[:10])
    else:
        print("[cad-parser] floor_title_samples=[]")
    candidate_samples = [
        {
            "label": candidate.label,
            "type": candidate.room_type,
            "source": candidate.source_type,
            "area": round(candidate.bounds.area, 2),
            "bounds": candidate.bounds.to_dict(),
        }
        for candidate in sorted(candidates, key=lambda item: item.bounds.area, reverse=True)[:12]
    ]
    print("[cad-parser] candidate_samples=", candidate_samples)


def log_entity_statistics(layout) -> None:
    entity_counts: dict[str, int] = {}
    layer_counts: dict[str, int] = {}
    block_counts: dict[str, int] = {}

    for entity in layout:
        dxftype = entity.dxftype()
        entity_counts[dxftype] = entity_counts.get(dxftype, 0) + 1
        layer = getattr(entity.dxf, "layer", "") or ""
        layer_counts[layer] = layer_counts.get(layer, 0) + 1
        if dxftype == "INSERT":
            block_name = getattr(entity.dxf, "name", "") or ""
            block_counts[block_name] = block_counts.get(block_name, 0) + 1

    top_entities = sorted(entity_counts.items(), key=lambda item: item[1], reverse=True)[:8]
    top_layers = sorted(layer_counts.items(), key=lambda item: item[1], reverse=True)[:8]
    top_blocks = sorted(block_counts.items(), key=lambda item: item[1], reverse=True)[:8]
    print("[cad-parser] top_entities=", top_entities)
    print("[cad-parser] top_layers=", top_layers)
    print("[cad-parser] top_blocks=", top_blocks)


def escape_xml(value: str) -> str:
    return (
        (value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
