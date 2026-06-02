# CAD Engine API

Backend import bản vẽ hiện hỗ trợ tích hợp `CAD engine` ngoài cho `DWG/DXF`.

## Cấu hình

Trong backend:

```properties
app.asset-map-import.cad-engine.enabled=true
app.asset-map-import.cad-engine.base-url=https://your-cad-engine.example.com
app.asset-map-import.cad-engine.api-key=secret
```

Backend sẽ gọi 2 endpoint:

- `POST {base-url}/discover`
- `POST {base-url}/parse-selected`

## 1. Discover

Request:

```json
{
  "jobId": 123,
  "sourceFileName": "nha-pho.dwg",
  "sourceFileType": "DWG",
  "sourceFileUrl": "https://public-file-url"
}
```

Response:

```json
{
  "engineName": "cad-engine-v1",
  "sheets": [
    {
      "sheetKey": "layout-1",
      "title": "MAT BANG TANG 1",
      "drawingType": "FLOOR_PLAN",
      "pageNumber": 1,
      "sortOrder": 0,
      "widthPx": 1800,
      "heightPx": 1200,
      "previewImageUrl": "https://public-preview-url",
      "previewBounds": {
        "x": 120,
        "y": 80,
        "width": 720,
        "height": 420
      },
      "confidence": 0.94,
      "selectedByDefault": true,
      "notes": "Detected from layout title"
    }
  ]
}
```

## 2. Parse Selected

Request:

```json
{
  "jobId": 123,
  "sourceFileName": "nha-pho.dwg",
  "sourceFileType": "DWG",
  "sourceFileUrl": "https://public-file-url",
  "selectedSheets": [
    {
      "importFloorId": 10,
      "sourceFloorKey": "layout-1",
      "suggestedName": "MAT BANG TANG 1",
      "friendlyLabel": "Mặt bằng tầng 1",
      "drawingType": "FLOOR_PLAN",
      "previewImageUrl": "https://public-preview-url",
      "previewBoundsJson": "{\"type\":\"rect\",\"x\":120,\"y\":80,\"width\":720,\"height\":420}"
    }
  ]
}
```

Response:

```json
{
  "engineName": "cad-engine-v1",
  "sheets": [
    {
      "sheetKey": "layout-1",
      "suggestions": [
        {
          "labelText": "PHONG KHACH",
          "normalizedName": "Phòng khách",
          "suggestionType": "ROOM",
          "bounds": {
            "x": 220,
            "y": 130,
            "width": 180,
            "height": 120
          },
          "colorHex": "#F97316",
          "hasAssetSuggested": true,
          "confidenceScore": 0.91,
          "sourceMethod": "CAD_ENGINE",
          "notes": "Detected from room contour + text"
        }
      ]
    }
  ]
}
```

## Ghi chú

- `drawingType` nên dùng một trong các giá trị:
  - `FLOOR_PLAN`
  - `DIMENSION_PLAN`
  - `SITE_PLAN`
  - `STAIR_PLAN`
  - `MEP`
  - `ELEVATION`
  - `SECTION`
  - `PERSPECTIVE`
  - `DOOR_SCHEDULE`
  - `UNKNOWN`
- `suggestionType` nên dùng:
  - `ROOM`
  - `CORRIDOR`
  - `STAIR`
  - `ELEVATOR`
  - `YARD`
  - `ROAD`
  - `GATE`
  - `UNKNOWN`
- Nếu CAD engine không được cấu hình hoặc lỗi, backend sẽ fallback về luồng heuristic hiện có.
