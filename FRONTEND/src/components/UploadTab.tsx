import React, { useState, useRef } from 'react';
import type { DatasetInfo, DuplicateAlert, UploadResponse } from '@/types';
import { uploadDataset, deleteDataset } from '@/api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Check,
  Hash,
  Database,
  ArrowRight,
  Info,
} from 'lucide-react';

interface UploadTabProps {
  datasets: DatasetInfo[];
  activeDataset: DatasetInfo | null;
  onSelectDataset: (dataset: DatasetInfo) => void;
  onDatasetsChange: (datasets: DatasetInfo[]) => void;
  onDatasetDeleted: (id: number) => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  datasets,
  activeDataset,
  onSelectDataset,
  onDatasetsChange,
  onDatasetDeleted,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadResult, setLastUploadResult] = useState<UploadResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileUpload(e.target.files[0]);
      // Reset input value so re-uploading the same file still triggers onChange
      e.target.value = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls|json)$/i)) {
      setUploadError('Unsupported file type. Please upload a CSV, Excel (.xlsx/.xls), or JSON file.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setLastUploadResult(null);

    try {
      const result = await uploadDataset(file, (percent) => {
        setUploadProgress(percent);
      });

      setLastUploadResult(result);
      // Update global datasets list
      const existing = datasets.find((d) => d.id === result.dataset.id);
      let updated: DatasetInfo[];
      if (existing) {
        updated = datasets.map((d) => (d.id === result.dataset.id ? result.dataset : d));
      } else {
        updated = [result.dataset, ...datasets];
      }
      onDatasetsChange(updated);
      onSelectDataset(result.dataset);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload dataset. Please verify the server is running.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this dataset from the registry?')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteDataset(id);
      onDatasetDeleted(id);
      if (lastUploadResult?.dataset.id === id) {
        setLastUploadResult(null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to extract duplicate info safely
  const duplicateAlert: DuplicateAlert | null = lastUploadResult?.duplicate_alert || null;
  const isExactDuplicate =
    duplicateAlert &&
    (duplicateAlert.duplicate_type === 'exact' ||
      duplicateAlert.similarity_details?.jaccard_similarity === 1.0 ||
      duplicateAlert.is_duplicate === true && !duplicateAlert.similarity_details?.cosine_similarity);

  const isNearDuplicate =
    duplicateAlert &&
    (duplicateAlert.duplicate_type === 'near' ||
      (duplicateAlert.similarity_details &&
        (duplicateAlert.similarity_details.jaccard_similarity !== undefined ||
          duplicateAlert.similarity_details.cosine_similarity !== undefined)));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Upload Zone */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500" />
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-cyan-400" />
            Upload Dataset & Duplicate Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload CSV or Excel data. DataGuard hashes every file with SHA-256, compares schemas, and
            analyzes feature distributions for exact or near-duplicate detection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/30 scale-[1.005]'
                : 'border-slate-700 bg-slate-900/40 hover:border-cyan-500/60 hover:bg-slate-800/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
            />
            <div className="p-4 rounded-full bg-slate-800/80 border border-slate-700 text-cyan-400 mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-base font-medium text-slate-200 text-center">
              Drag & Drop your dataset here, or{' '}
              <span className="text-cyan-400 underline underline-offset-4 font-semibold hover:text-cyan-300">
                browse files
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports CSV, Excel (.xlsx, .xls), JSON files up to 100MB</p>

            {isUploading && (
              <div className="w-full max-w-md mt-6 space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Uploading & Processing...</span>
                  <span className="font-semibold text-cyan-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Upload Error Alert */}
          {uploadError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Upload Failed</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Duplicate Detection Alert & Upload Summary */}
          {lastUploadResult && (
            <div className="mt-6 space-y-4">
              {/* Duplicate Alerts */}
              {isExactDuplicate ? (
                <Alert variant="destructive" className="border-rose-800 bg-rose-950/40">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  <AlertTitle className="text-rose-200 font-bold flex items-center gap-2">
                    Exact Duplicate Detected!
                  </AlertTitle>
                  <AlertDescription className="text-rose-300 mt-1 space-y-1">
                    <p>
                      This file matches an existing dataset in SHA-256 fingerprint and exact content.
                    </p>
                    {duplicateAlert?.matching_filename && (
                      <p className="text-xs font-mono bg-rose-900/50 p-2 rounded border border-rose-700/50 inline-block">
                        Matches: {duplicateAlert.matching_filename}
                      </p>
                    )}
                    {duplicateAlert?.matching_datasets && duplicateAlert.matching_datasets.length > 0 && (
                      <p className="text-xs font-mono bg-rose-900/50 p-2 rounded border border-rose-700/50 inline-block">
                        Matching ID(s):{' '}
                        {duplicateAlert.matching_datasets
                          .map((m) => m.filename || `#${m.id}`)
                          .join(', ')}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              ) : isNearDuplicate ? (
                <Alert variant="warning" className="border-amber-800 bg-amber-950/40">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <AlertTitle className="text-amber-200 font-bold flex items-center gap-2">
                    Near-Duplicate Warning
                  </AlertTitle>
                  <AlertDescription className="text-amber-300 mt-1 space-y-2">
                    <p>
                      High structural or feature similarity found with previously ingested datasets:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {duplicateAlert?.similarity_details?.jaccard_similarity !== undefined && (
                        <div className="bg-amber-900/40 border border-amber-700/40 p-2.5 rounded-lg">
                          <span className="text-xs text-amber-400 block font-medium">Jaccard Column Similarity</span>
                          <span className="text-lg font-bold font-mono">
                            {(duplicateAlert.similarity_details.jaccard_similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {duplicateAlert?.similarity_details?.cosine_similarity !== undefined && (
                        <div className="bg-amber-900/40 border border-amber-700/40 p-2.5 rounded-lg">
                          <span className="text-xs text-amber-400 block font-medium">Cosine Vector Similarity</span>
                          <span className="text-lg font-bold font-mono">
                            {(duplicateAlert.similarity_details.cosine_similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {duplicateAlert?.matching_filename && (
                        <div className="bg-amber-900/40 border border-amber-700/40 p-2.5 rounded-lg">
                          <span className="text-xs text-amber-400 block font-medium">Closest Match</span>
                          <span className="text-xs font-mono font-bold truncate block">
                            {duplicateAlert.matching_filename}
                          </span>
                        </div>
                      )}
                    </div>
                    {duplicateAlert?.similarity_details?.feature_distances && (
                      <div className="text-xs font-mono text-amber-400/90 pt-1">
                        Feature Distances:{' '}
                        {JSON.stringify(duplicateAlert.similarity_details.feature_distances)}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="success" className="border-teal-800 bg-teal-950/40">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  <AlertTitle className="text-teal-200 font-bold">Unique Dataset Ingested</AlertTitle>
                  <AlertDescription className="text-teal-300">
                    Fingerprint verified. No matching duplicates or conflicts found in the registry.
                  </AlertDescription>
                </Alert>
              )}

              {/* Ingested Dataset Metadata Preview */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                      {lastUploadResult.dataset.filename}
                      <Badge variant="default" className="text-[10px]">
                        ID #{lastUploadResult.dataset.id}
                      </Badge>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      SHA-256: {lastUploadResult.dataset.sha256_hash}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm text-slate-300">
                  <div>
                    <span className="text-xs text-slate-400 block">Rows</span>
                    <span className="font-bold font-mono text-cyan-300">
                      {lastUploadResult.dataset.row_count.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Columns</span>
                    <span className="font-bold font-mono text-cyan-300">
                      {lastUploadResult.dataset.col_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Size</span>
                    <span className="font-mono text-slate-200">
                      {formatFileSize(lastUploadResult.dataset.file_size)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dataset Registry */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              Dataset Registry
            </CardTitle>
            <CardDescription className="text-slate-400">
              Manage uploaded datasets. Click a row to set it as active for analysis and cleaning.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            {datasets.length} {datasets.length === 1 ? 'Dataset' : 'Datasets'} Registered
          </Badge>
        </CardHeader>
        <CardContent>
          {datasets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-medium text-slate-300">No datasets uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Upload a CSV or Excel dataset above to explore statistical profiling, t-tests,
                clustering, and data cleaning.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-950/60 hover:bg-slate-950/60">
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Cols</TableHead>
                    <TableHead>SHA-256 (Truncated)</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => {
                    const isActive = activeDataset?.id === dataset.id;
                    const truncatedHash =
                      dataset.sha256_hash.length > 16
                        ? `${dataset.sha256_hash.slice(0, 8)}...${dataset.sha256_hash.slice(-8)}`
                        : dataset.sha256_hash;

                    return (
                      <TableRow
                        key={dataset.id}
                        onClick={() => onSelectDataset(dataset)}
                        className={`cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-cyan-950/30 border-cyan-500/40 hover:bg-cyan-950/40'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <TableCell>
                          {isActive ? (
                            <Badge variant="default" className="text-[10px] px-2 py-0.5">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-slate-500">
                              Idle
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">
                          #{dataset.id}
                        </TableCell>
                        <TableCell className="font-medium text-slate-100 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={dataset.filename}>
                            {dataset.filename}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-cyan-300">
                          {dataset.row_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-cyan-300">
                          {dataset.col_count}
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-mono text-xs bg-slate-950 px-2 py-1 rounded border border-slate-800 text-slate-400 inline-flex items-center gap-1"
                            title={dataset.sha256_hash}
                          >
                            <Hash className="w-3 h-3 text-slate-500" />
                            {truncatedHash}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                          {formatDate(dataset.uploaded_at)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant={isActive ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onSelectDataset(dataset)}
                              className="text-xs h-7 px-2.5"
                            >
                              {isActive ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" /> Selected
                                </>
                              ) : (
                                <>
                                  Select <ArrowRight className="w-3 h-3 ml-1" />
                                </>
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingId === dataset.id}
                              isLoading={deletingId === dataset.id}
                              onClick={(e) => handleDelete(e, dataset.id)}
                              className="h-7 w-7 p-0"
                              title="Delete dataset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
