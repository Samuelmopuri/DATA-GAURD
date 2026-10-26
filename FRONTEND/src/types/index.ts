export interface DatasetInfo {
  id: number;
  filename: string;
  sha256_hash: string;
  file_size: number;
  row_count: number;
  col_count: number;
  columns: string[];
  numeric_columns: string[];
  uploaded_at: string;
}

export interface SimilarityDetails {
  jaccard_similarity?: number;
  cosine_similarity?: number;
  feature_distances?: Record<string, number>;
  matched_columns?: string[];
  [key: string]: any;
}

export interface MatchingDataset {
  id?: number;
  filename?: string;
  sha256_hash?: string;
  similarity?: number;
  uploaded_at?: string;
  [key: string]: any;
}

export interface DuplicateAlert {
  is_duplicate: boolean;
  duplicate_type?: 'exact' | 'near' | string | null;
  similarity_details?: SimilarityDetails | null;
  matching_datasets?: MatchingDataset[];
  matching_filename?: string;
  message?: string;
  [key: string]: any;
}

export interface UploadResponse {
  dataset: DatasetInfo;
  duplicate_alert?: DuplicateAlert | null;
}

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  duplicate_type?: string | null;
  similarity_details?: Record<string, any> | null;
  matching_datasets: Record<string, any>[];
}

export interface ColumnStats {
  column_name: string;
  count: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  variance: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  skewness: number | null;
  missing_count: number;
  missing_pct: number;
}

export interface ProfileResponse {
  dataset_id: number;
  columns: ColumnStats[];
  row_count: number;
  col_count: number;
}

export interface TTestRequest {
  column1: string;
  column2: string;
}

export interface TTestResponse {
  column1: string;
  column2: string;
  t_statistic: number;
  p_value: number;
  alpha: number;
  reject_null: boolean;
  interpretation: string;
  n1: number;
  n2: number;
  mean1: number;
  mean2: number;
  std1: number;
  std2: number;
}

export interface ClusterRequest {
  columns: string[];
  k: number;
}

export interface ClusterRecord {
  index: number;
  cluster: number;
  is_outlier: boolean;
  distance_to_center: number;
  [key: string]: any;
}

export interface ClusterResponse {
  columns: string[];
  k: number;
  cluster_centers: number[][];
  outliers: number[];
  outlier_threshold: number;
  inertia: number;
  records: Record<string, any>[];
}

export interface CleaningRecommendation {
  column_name: string;
  missing_count: number;
  missing_pct: number;
  skewness: number | null;
  recommended_method: 'mean' | 'median' | 'mode' | string;
  reason: string;
}

export interface CleaningRecommendationsResponse {
  dataset_id: number;
  recommendations: CleaningRecommendation[];
}

export interface ImputeRequest {
  columns?: string[];
}

export interface OutlierColumnSummary {
  column: string;
  q1: number;
  q3: number;
  iqr: number;
  lower_fence: number;
  upper_fence: number;
  affected_count: number;
}

export interface OutlierRequest {
  method: 'cap' | 'prune';
  columns: string[];
}

export interface OutlierTreatmentResponse {
  message?: string;
  method?: string;
  columns?: string[];
  dataset?: DatasetInfo;
  summaries?: OutlierColumnSummary[];
  details?: Record<string, OutlierColumnSummary>;
  rows_removed?: number;
  rows_remaining?: number;
  [key: string]: any;
}

export interface PrivacyScanResult {
  column_name: string;
  emails_found: number;
  phones_found: number;
  total_pii: number;
}

export interface PrivacyResponse {
  dataset_id: number;
  scan_results: PrivacyScanResult[];
  total_pii_found: number;
  masked: boolean;
}

export interface DistributionBin {
  range_label: string;
  count: number;
  [key: string]: any;
}

export interface DistributionData {
  column_name: string;
  bins: DistributionBin[];
}

export interface PreviewData {
  data: Record<string, any>[];
  columns: string[];
  total_rows?: number;
}
