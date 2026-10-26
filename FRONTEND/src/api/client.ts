import axios, { AxiosError } from 'axios';
import type {
  DatasetInfo,
  UploadResponse,
  ProfileResponse,
  TTestResponse,
  ClusterResponse,
  CleaningRecommendationsResponse,
  PrivacyResponse,
  DistributionData,
  PreviewData,
  OutlierTreatmentResponse,
} from '@/types';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 60000,
  headers: {
    'Accept': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { message: string } }>) => {
    let message = 'An unexpected error occurred';
    if (error.response?.data) {
      if (typeof error.response.data.detail === 'string') {
        message = error.response.data.detail;
      } else if (typeof error.response.data === 'string') {
        message = error.response.data;
      } else if (error.response.data.detail && typeof error.response.data.detail === 'object') {
        message = JSON.stringify(error.response.data.detail);
      }
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  }
);

export const uploadDataset = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return response.data;
};

export const getDatasets = async (): Promise<DatasetInfo[]> => {
  const response = await api.get<DatasetInfo[]>('/api/datasets');
  return response.data;
};

export const getDataset = async (id: number): Promise<DatasetInfo> => {
  const response = await api.get<DatasetInfo>(`/api/datasets/${id}`);
  return response.data;
};

export const deleteDataset = async (id: number): Promise<{ message: string; success?: boolean }> => {
  const response = await api.delete<{ message: string; success?: boolean }>(`/api/datasets/${id}`);
  return response.data;
};

export const getPreview = async (id: number): Promise<PreviewData> => {
  const response = await api.get<PreviewData | Record<string, any>[]>(`/api/datasets/${id}/preview`);
  // If backend directly returns an array of records
  if (Array.isArray(response.data)) {
    const rawData = response.data;
    const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];
    return {
      data: rawData,
      columns,
      total_rows: rawData.length,
    };
  }
  return response.data;
};

export const getProfile = async (id: number): Promise<ProfileResponse> => {
  const response = await api.get<ProfileResponse>(`/api/analysis/${id}/profile`);
  return response.data;
};

export const runTTest = async (
  id: number,
  col1: string,
  col2: string
): Promise<TTestResponse> => {
  const response = await api.post<TTestResponse>(`/api/analysis/${id}/ttest`, {
    column1: col1,
    column2: col2,
  });
  return response.data;
};

export const getDistributions = async (id: number): Promise<DistributionData[]> => {
  const response = await api.get<DistributionData[]>(`/api/analysis/${id}/distributions`);
  return response.data;
};

export const runClustering = async (
  id: number,
  columns: string[],
  k: number
): Promise<ClusterResponse> => {
  const response = await api.post<ClusterResponse>(`/api/analysis/${id}/cluster`, {
    columns,
    k,
  });
  return response.data;
};

export const getCleaningRecommendations = async (
  id: number
): Promise<CleaningRecommendationsResponse> => {
  const response = await api.get<CleaningRecommendationsResponse>(
    `/api/cleaning/${id}/recommendations`
  );
  return response.data;
};

export const applyImputation = async (
  id: number,
  columns?: string[]
): Promise<{ message: string; dataset?: DatasetInfo; [key: string]: any }> => {
  const response = await api.post<{ message: string; dataset?: DatasetInfo; [key: string]: any }>(
    `/api/cleaning/${id}/impute`,
    {
      columns: columns && columns.length > 0 ? columns : undefined,
    }
  );
  return response.data;
};

export const applyOutlierTreatment = async (
  id: number,
  method: string,
  columns: string[]
): Promise<OutlierTreatmentResponse> => {
  const response = await api.post<OutlierTreatmentResponse>(`/api/cleaning/${id}/outliers`, {
    method,
    columns,
  });
  return response.data;
};

export const scanPrivacy = async (id: number): Promise<PrivacyResponse> => {
  const response = await api.post<PrivacyResponse>(`/api/cleaning/${id}/privacy/scan`);
  return response.data;
};

export const maskPrivacy = async (id: number): Promise<PrivacyResponse> => {
  const response = await api.post<PrivacyResponse>(`/api/cleaning/${id}/privacy/mask`);
  return response.data;
};

export const exportDataset = async (id: number, filename = 'cleaned_dataset.csv'): Promise<void> => {
  const response = await api.get(`/api/cleaning/${id}/export`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
