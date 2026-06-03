# CAD Parser Service

Microservice Python `FastAPI` để Spring Boot gọi sang khi import `DWG/DXF`.

## Tính năng hiện có

- `POST /analyze` nhận file `DWG` hoặc `DXF`
- Parse `DXF` thật bằng `ezdxf`
- Hỗ trợ `DWG` nếu máy đã cài `ODA File Converter`
- Tách tương đối theo cụm bản vẽ con
- Nhận diện cơ bản các loại:
  - `room`
  - `corridor`
  - `staircase`
  - `elevator`
  - `wc`
  - `wall`
  - `road`
- Trả preview dạng `data:image/svg+xml;base64,...`

## Lưu ý quan trọng

- `ezdxf` đọc tốt `DXF`, không đọc trực tiếp `DWG`
- Muốn parse `DWG`, bạn cần cài thêm `ODA File Converter` rồi set env:

```bash
export CAD_IMPORT_ODA_EXECUTABLE_PATH="/đường/dẫn/tới/ODAFileConverter"
```

- Nếu chưa có ODA, bạn vẫn test được luồng bằng file `DXF`

## Cài local

```bash
cd /Users/tranminh/FPOLY/AI/mhv/cad-parser-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Chạy local

```bash
cd /Users/tranminh/FPOLY/AI/mhv/cad-parser-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Test nhanh

- Mở:
  - `http://localhost:8000`
  - `http://localhost:8000/health`
  - `http://localhost:8000/docs`

## Nối với Spring Boot

Set env cho backend Java:

```bash
APP_ASSET_MAP_IMPORT_FASTAPI_BASE_URL=http://localhost:8000
APP_ASSET_MAP_IMPORT_FASTAPI_ANALYZE_PATH=/analyze
```

## Format JSON trả về

Ví dụ:

```json
{
  "drawings": [
    {
      "drawingId": "drawing-1",
      "title": "Mặt bằng tầng 1",
      "previewUrl": "data:image/svg+xml;base64,...",
      "bounds": {
        "minX": 0,
        "minY": 0,
        "maxX": 15000,
        "maxY": 5000,
        "width": 15000,
        "height": 5000
      },
      "rooms": [
        {
          "name": "Phòng khách",
          "type": "room",
          "bounds": {
            "minX": 100,
            "minY": 100,
            "maxX": 5000,
            "maxY": 3000,
            "width": 4900,
            "height": 2900
          },
          "polygon": [
            { "x": 100, "y": 100 },
            { "x": 5000, "y": 100 },
            { "x": 5000, "y": 3000 },
            { "x": 100, "y": 3000 }
          ]
        }
      ]
    }
  ]
}
```
