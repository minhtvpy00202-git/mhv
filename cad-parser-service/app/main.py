from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile

from .parser_service import CadParseError, PARSER_RULESET_VERSION, analyze_cad_file


app = FastAPI(
    title="CAD Parser Service",
    version="1.0.0",
    description="Microservice Python FastAPI dùng để parse DWG/DXF và trả JSON cho Spring Boot.",
)


@app.get("/")
def root() -> dict:
    return {
        "message": "cad parser service is running",
        "docs": "/docs",
        "health": "/health",
        "parserRulesetVersion": PARSER_RULESET_VERSION,
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "parserRulesetVersion": PARSER_RULESET_VERSION,
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Thiếu tên file upload.")

    suffix = Path(filename).suffix.lower()
    if suffix not in {".dwg", ".dxf"}:
        raise HTTPException(status_code=422, detail="Chỉ hỗ trợ file DWG hoặc DXF.")

    with tempfile.TemporaryDirectory(prefix="cad-parser-upload-") as temp_dir:
        upload_path = Path(temp_dir) / filename
        upload_path.write_bytes(await file.read())
        try:
            return analyze_cad_file(upload_path)
        except CadParseError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Lỗi nội bộ khi phân tích CAD: {exc}") from exc
