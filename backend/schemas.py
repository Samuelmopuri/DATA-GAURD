from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class DatasetInfo(BaseModel):
    id: int
    filename: str
    sha256_hash: str
    file_size: int
    row_count: int
    col_count: int
    columns: list[str]
    numeric_columns: list[str]
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UploadResponse(BaseModel):
    dataset: DatasetInfo
    duplicate_alert: Optional[dict[str, Any]] = None


class DuplicateCheckResult(BaseModel):
    is_duplicate: bool
    duplicate_type: Optional[str] = None
    similarity_details: Optional[dict[str, Any]] = None
    matching_datasets: list[dict[str, Any]] = Field(default_factory=list)


class ColumnStats(BaseModel):
    column_name: str
    count: int
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    variance: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    iqr: Optional[float] = None
    skewness: Optional[float] = None
    missing_count: int
    missing_pct: float


class ProfileResponse(BaseModel):
    dataset_id: int
    columns: list[ColumnStats]
    row_count: int
    col_count: int


class TTestRequest(BaseModel):
    column1: str
    column2: str


class TTestResponse(BaseModel):
    column1: str
    column2: str
    t_statistic: float
    p_value: float
    alpha: float = 0.05
    reject_null: bool
    interpretation: str
    n1: int
    n2: int
    mean1: float
    mean2: float
    std1: float
    std2: float


class ClusterRequest(BaseModel):
    columns: list[str]
    k: int = 3


class ClusterResponse(BaseModel):
    columns: list[str]
    k: int
    cluster_centers: list[list[float]]
    outliers: list[int]
    outlier_threshold: float
    inertia: float
    records: list[dict[str, Any]]


class CleaningRecommendation(BaseModel):
    column_name: str
    missing_count: int
    missing_pct: float
    skewness: Optional[float] = None
    recommended_method: str  # 'mean' | 'median' | 'mode'
    reason: str


class CleaningRecommendationsResponse(BaseModel):
    dataset_id: int
    recommendations: list[CleaningRecommendation]


class ImputeRequest(BaseModel):
    columns: Optional[list[str]] = None


class OutlierRequest(BaseModel):
    method: str  # 'cap' | 'prune'
    columns: list[str]


class PrivacyScanResult(BaseModel):
    column_name: str
    emails_found: int
    phones_found: int
    total_pii: int


class PrivacyResponse(BaseModel):
    dataset_id: int
    scan_results: list[PrivacyScanResult]
    total_pii_found: int
    masked: bool = False


class DistributionBin(BaseModel):
    range_label: str
    count: int


class DistributionData(BaseModel):
    column_name: str
    bins: list[dict[str, Any]]
