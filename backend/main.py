import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from typing import List

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

try:
    from .database import get_db, init_db
    from .models import DatasetRecord
    from .schemas import (
        CleaningRecommendationsResponse,
        ClusterRequest,
        ClusterResponse,
        ColumnStats,
        DatasetInfo,
        DistributionData,
        ImputeRequest,
        OutlierRequest,
        PrivacyResponse,
        PrivacyScanResult,
        ProfileResponse,
        TTestRequest,
        TTestResponse,
        UploadResponse,
    )
    from .services.cleaning import (
        apply_imputation,
        apply_outlier_treatment,
        generate_cleaning_recommendations,
    )
    from .services.clustering import run_kmeans_outlier_detection
    from .services.duplicate_detection import (
        compute_cosine_similarity_profile,
        compute_jaccard_similarity,
    )
    from .services.hashing import compute_sha256
    from .services.privacy import mask_pii, scan_pii
    from .services.statistics import (
        compute_column_stats,
        compute_distribution,
        run_ttest,
    )
except ImportError:
    from database import get_db, init_db
    from models import DatasetRecord
    from schemas import (
        CleaningRecommendationsResponse,
        ClusterRequest,
        ClusterResponse,
        ColumnStats,
        DatasetInfo,
        DistributionData,
        ImputeRequest,
        OutlierRequest,
        PrivacyResponse,
        PrivacyScanResult,
        ProfileResponse,
        TTestRequest,
        TTestResponse,
        UploadResponse,
    )
    from services.cleaning import (
        apply_imputation,
        apply_outlier_treatment,
        generate_cleaning_recommendations,
    )
    from services.clustering import run_kmeans_outlier_detection
    from services.duplicate_detection import (
        compute_cosine_similarity_profile,
        compute_jaccard_similarity,
    )
    from services.hashing import compute_sha256
    from services.privacy import mask_pii, scan_pii
    from services.statistics import (
        compute_column_stats,
        compute_distribution,
        run_ttest,
    )

UPLOAD_DIR = "./uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title="DataGuard Backend API",
    description="Automated Data Quality & Integrity Auditing Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_dataframe(storage_path: str) -> pd.DataFrame:
    """Load DataFrame from disk using storage path."""
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")
    if storage_path.endswith(".xlsx") or storage_path.endswith(".xls"):
        return pd.read_excel(storage_path)
    return pd.read_csv(storage_path)


def save_dataframe(df: pd.DataFrame, storage_path: str) -> None:
    """Save DataFrame to disk preserving its format."""
    if storage_path.endswith(".xlsx") or storage_path.endswith(".xls"):
        df.to_excel(storage_path, index=False)
    else:
        df.to_csv(storage_path, index=False)


def record_to_dataset_info(record: DatasetRecord) -> DatasetInfo:
    """Convert DatasetRecord ORM object to DatasetInfo Pydantic schema."""
    return DatasetInfo(
        id=record.id,
        filename=record.filename,
        sha256_hash=record.sha256_hash,
        file_size=record.file_size,
        row_count=record.row_count,
        col_count=record.col_count,
        columns=json.loads(record.columns_json),
        numeric_columns=json.loads(record.numeric_columns_json),
        uploaded_at=record.uploaded_at,
    )


# ---------------------------------------------------------
# Dataset Endpoints
# ---------------------------------------------------------


@app.post("/api/upload", response_model=UploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Accept CSV/XLSX file, compute SHA-256 hash, check for duplicates (exact & near),
    parse file metadata, save to disk, and register in database.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = file.filename or "uploaded_dataset.csv"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a CSV or Excel (.xlsx) file.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    sha256 = compute_sha256(file_bytes)

    # Parse into pandas DataFrame
    try:
        if ext in [".xlsx", ".xls"]:
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to parse dataset: {str(e)}"
        )

    columns = [str(c) for c in df.columns]
    numeric_columns = [
        str(c) for c in df.select_dtypes(include=[np.number]).columns
    ]
    row_count = int(len(df))
    col_count = int(len(columns))

    # Exact duplicate check
    duplicate_alert = None
    exact_match = (
        db.query(DatasetRecord)
        .filter(DatasetRecord.sha256_hash == sha256)
        .first()
    )

    if exact_match:
        duplicate_alert = {
            "type": "exact",
            "matching_dataset": {
                "id": exact_match.id,
                "filename": exact_match.filename,
                "row_count": exact_match.row_count,
                "col_count": exact_match.col_count,
            },
            "similarity_scores": {"sha256_match": 1.0},
        }
    else:
        # Near duplicate check against existing datasets
        existing_datasets = db.query(DatasetRecord).all()
        for ex in existing_datasets:
            try:
                ex_cols = json.loads(ex.columns_json)
                jaccard = compute_jaccard_similarity(columns, ex_cols)
                if jaccard >= 0.5 and os.path.exists(ex.storage_path):
                    ex_df = load_dataframe(ex.storage_path)
                    cosine, diffs = compute_cosine_similarity_profile(df, ex_df)
                    if jaccard >= 0.8 and cosine >= 0.8:
                        duplicate_alert = {
                            "type": "near",
                            "matching_dataset": {
                                "id": ex.id,
                                "filename": ex.filename,
                                "row_count": ex.row_count,
                                "col_count": ex.col_count,
                            },
                            "similarity_scores": {
                                "jaccard": round(jaccard, 4),
                                "cosine": round(cosine, 4),
                                "column_differences": diffs,
                            },
                        }
                        break
            except Exception:
                continue

    # Persist file
    stored_name = f"{uuid.uuid4()}_{filename}"
    storage_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    # Create DB Record
    record = DatasetRecord(
        filename=filename,
        sha256_hash=sha256,
        file_size=len(file_bytes),
        row_count=row_count,
        col_count=col_count,
        columns_json=json.dumps(columns),
        numeric_columns_json=json.dumps(numeric_columns),
        storage_path=storage_path,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return UploadResponse(
        dataset=record_to_dataset_info(record),
        duplicate_alert=duplicate_alert,
    )


@app.get("/api/datasets", response_model=List[DatasetInfo])
def list_datasets(db: Session = Depends(get_db)):
    """List all uploaded datasets ordered by ID descending."""
    records = db.query(DatasetRecord).order_by(DatasetRecord.id.desc()).all()
    return [record_to_dataset_info(r) for r in records]


@app.get("/api/datasets/{dataset_id}", response_model=DatasetInfo)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Get metadata for a single dataset by ID."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return record_to_dataset_info(record)


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Delete a dataset and its physical file on disk."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if os.path.exists(record.storage_path):
        try:
            os.remove(record.storage_path)
        except OSError:
            pass

    db.delete(record)
    db.commit()
    return {"message": "Dataset deleted successfully", "id": dataset_id}


@app.get("/api/datasets/{dataset_id}/preview")
def get_dataset_preview(dataset_id: int, db: Session = Depends(get_db)):
    """Return the first 100 rows of the dataset as a list of dicts."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    preview_df = df.head(100)
    preview_data = (
        preview_df.replace({np.nan: None, np.inf: None, -np.inf: None})
        .to_dict(orient="records")
    )
    return preview_data


# ---------------------------------------------------------
# Analysis Endpoints
# ---------------------------------------------------------


@app.get("/api/analysis/{dataset_id}/profile", response_model=ProfileResponse)
def get_dataset_profile(dataset_id: int, db: Session = Depends(get_db)):
    """Compute and return comprehensive column statistics."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    stats_list = []
    for col in df.columns:
        col_stat = compute_column_stats(df[col])
        stats_list.append(ColumnStats(**col_stat))

    return ProfileResponse(
        dataset_id=dataset_id,
        columns=stats_list,
        row_count=int(len(df)),
        col_count=int(len(df.columns)),
    )


@app.post("/api/analysis/{dataset_id}/ttest", response_model=TTestResponse)
def run_dataset_ttest(
    dataset_id: int,
    req: TTestRequest,
    db: Session = Depends(get_db),
):
    """Run independent two-sample t-test between two columns."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    if req.column1 not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{req.column1}' not found in dataset.",
        )
    if req.column2 not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{req.column2}' not found in dataset.",
        )

    try:
        res = run_ttest(df[req.column1], df[req.column2])
        return TTestResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/{dataset_id}/distributions", response_model=List[DistributionData])
def get_dataset_distributions(dataset_id: int, db: Session = Depends(get_db)):
    """Return distribution data (histograms) for all numeric columns."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    distributions = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            bins = compute_distribution(df[col], bins=10)
            distributions.append(DistributionData(column_name=str(col), bins=bins))

    return distributions


@app.post("/api/analysis/{dataset_id}/cluster", response_model=ClusterResponse)
def run_dataset_cluster(
    dataset_id: int,
    req: ClusterRequest,
    db: Session = Depends(get_db),
):
    """Run KMeans clustering and outlier detection on specified numeric columns."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    for col in req.columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{col}' not found in dataset.",
            )

    try:
        result = run_kmeans_outlier_detection(df, req.columns, k=req.k)
        return ClusterResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------
# Cleaning Endpoints
# ---------------------------------------------------------


@app.get(
    "/api/cleaning/{dataset_id}/recommendations",
    response_model=CleaningRecommendationsResponse,
)
def get_cleaning_recommendations(dataset_id: int, db: Session = Depends(get_db)):
    """Generate skewness-based cleaning recommendations for columns with missing values."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    recs = generate_cleaning_recommendations(df)
    return CleaningRecommendationsResponse(
        dataset_id=dataset_id,
        recommendations=recs,
    )


@app.post("/api/cleaning/{dataset_id}/impute")
def impute_dataset(
    dataset_id: int,
    req: ImputeRequest,
    db: Session = Depends(get_db),
):
    """Apply recommended imputation to columns, update disk file and DB record."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    recs = generate_cleaning_recommendations(df)
    cleaned_df = apply_imputation(df, recs, req.columns)

    save_dataframe(cleaned_df, record.storage_path)

    # Recalculate file hash and metadata
    with open(record.storage_path, "rb") as f:
        new_bytes = f.read()

    record.sha256_hash = compute_sha256(new_bytes)
    record.file_size = len(new_bytes)
    record.row_count = int(len(cleaned_df))
    record.col_count = int(len(cleaned_df.columns))
    record.columns_json = json.dumps([str(c) for c in cleaned_df.columns])
    record.numeric_columns_json = json.dumps([
        str(c) for c in cleaned_df.select_dtypes(include=[np.number]).columns
    ])

    db.commit()
    db.refresh(record)

    imputed_cols = req.columns if req.columns is not None else [r["column_name"] for r in recs]
    return {
        "message": "Imputation applied successfully",
        "dataset_id": dataset_id,
        "columns_imputed": imputed_cols,
        "dataset": record_to_dataset_info(record),
    }


@app.post("/api/cleaning/{dataset_id}/outliers")
def treat_dataset_outliers(
    dataset_id: int,
    req: OutlierRequest,
    db: Session = Depends(get_db),
):
    """Apply IQR outlier treatment (cap or prune) and update dataset."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    for col in req.columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{col}' not found in dataset.",
            )

    try:
        cleaned_df, summary = apply_outlier_treatment(df, req.columns, req.method)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    save_dataframe(cleaned_df, record.storage_path)

    with open(record.storage_path, "rb") as f:
        new_bytes = f.read()

    record.sha256_hash = compute_sha256(new_bytes)
    record.file_size = len(new_bytes)
    record.row_count = int(len(cleaned_df))
    record.col_count = int(len(cleaned_df.columns))

    db.commit()
    db.refresh(record)

    return {
        "message": f"Outlier treatment ('{req.method}') applied successfully",
        "summary": summary,
        "remaining_rows": len(cleaned_df),
        "dataset": record_to_dataset_info(record),
    }


@app.post("/api/cleaning/{dataset_id}/privacy/scan", response_model=PrivacyResponse)
def scan_dataset_privacy(dataset_id: int, db: Session = Depends(get_db)):
    """Scan string/object columns for sensitive PII (emails, phone numbers)."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    results = scan_pii(df)
    total_pii = sum(r["total_pii"] for r in results)

    return PrivacyResponse(
        dataset_id=dataset_id,
        scan_results=[PrivacyScanResult(**r) for r in results],
        total_pii_found=total_pii,
        masked=False,
    )


@app.post("/api/cleaning/{dataset_id}/privacy/mask", response_model=PrivacyResponse)
def mask_dataset_privacy(dataset_id: int, db: Session = Depends(get_db)):
    """Mask sensitive PII in dataset and update stored file."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataframe(record.storage_path)
    masked_df = mask_pii(df)
    save_dataframe(masked_df, record.storage_path)

    with open(record.storage_path, "rb") as f:
        new_bytes = f.read()

    record.sha256_hash = compute_sha256(new_bytes)
    record.file_size = len(new_bytes)

    db.commit()
    db.refresh(record)

    results = scan_pii(masked_df)
    total_pii = sum(r["total_pii"] for r in results)

    return PrivacyResponse(
        dataset_id=dataset_id,
        scan_results=[PrivacyScanResult(**r) for r in results],
        total_pii_found=total_pii,
        masked=True,
    )


@app.get("/api/cleaning/{dataset_id}/export")
def export_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Download cleaned file from disk."""
    record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not os.path.exists(record.storage_path):
        raise HTTPException(status_code=404, detail="Stored file not found on disk")

    media_type = "text/csv" if record.filename.endswith(".csv") else "application/octet-stream"
    return FileResponse(
        path=record.storage_path,
        filename=record.filename,
        media_type=media_type,
    )
