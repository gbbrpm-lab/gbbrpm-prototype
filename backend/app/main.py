import math
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models import (
    DatasetPayload,
    DatasetSummary,
    EvaluationResponse,
    ValidationResponse,
)
from app.services.datasets import get_dataset, list_datasets
from app.services.evaluation import evaluate_dataset, validate_dataset


app = FastAPI(
    title="GBBRPM Prototype API",
    version="0.1.0",
    description="Dataset-neutral evaluation API for the GBBRPM thesis prototype.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sanitize_nonfinite(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        if math.isnan(value):
            return "NaN"
        return "Infinity" if value > 0 else "-Infinity"
    if isinstance(value, dict):
        return {k: _sanitize_nonfinite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_nonfinite(item) for item in value]
    return value


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    sanitized = _sanitize_nonfinite(jsonable_encoder(exc.errors()))
    return JSONResponse(status_code=422, content={"detail": sanitized})


@app.get("/api/health")
def health():
    return {"status": "ok", "model": "gbbrpm", "model_version": "0.1.0"}


@app.get("/api/datasets", response_model=list[DatasetSummary])
def datasets():
    return list_datasets()


@app.get("/api/datasets/{dataset_id}", response_model=DatasetPayload)
def dataset(dataset_id: str):
    selected = get_dataset(dataset_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return selected


@app.post("/api/datasets/validate", response_model=ValidationResponse)
def validate(payload: DatasetPayload):
    try:
        return validate_dataset(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/evaluate", response_model=EvaluationResponse)
def evaluate(payload: DatasetPayload):
    try:
        return evaluate_dataset(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

