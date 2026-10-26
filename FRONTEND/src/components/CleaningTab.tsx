import React, { useState } from 'react';
import type {
  DatasetInfo,
  CleaningRecommendation,
  PrivacyScanResult,
  OutlierTreatmentResponse,
} from '@/types';
import {
  getCleaningRecommendations,
  applyImputation,
  applyOutlierTreatment,
  scanPrivacy,
  maskPrivacy,
  exportDataset,
} from '@/api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Sliders,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Scissors,
  Wand2,
  RefreshCw,
  FileCheck,
} from 'lucide-react';

interface CleaningTabProps {
  activeDataset: DatasetInfo | null;
  onDatasetUpdated: (updatedDataset: DatasetInfo) => void;
  onNavigateToUpload: () => void;
}

export const CleaningTab: React.FC<CleaningTabProps> = ({
  activeDataset,
  onDatasetUpdated,
  onNavigateToUpload,
}) => {
  // Recommendations state
  const [recommendations, setRecommendations] = useState<CleaningRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [applyingImpute, setApplyingImpute] = useState(false);
  const [imputeSuccess, setImputeSuccess] = useState<string | null>(null);

  // Outliers state
  const [outlierMethod, setOutlierMethod] = useState<'cap' | 'prune'>('cap');
  const [selectedOutlierCols, setSelectedOutlierCols] = useState<string[]>([]);
  const [applyingOutliers, setApplyingOutliers] = useState(false);
  const [outlierResult, setOutlierResult] = useState<OutlierTreatmentResponse | null>(null);
  const [outlierError, setOutlierError] = useState<string | null>(null);

  // Privacy state
  const [privacyResults, setPrivacyResults] = useState<PrivacyScanResult[] | null>(null);
  const [totalPii, setTotalPii] = useState<number>(0);
  const [isMasked, setIsMasked] = useState(false);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [maskingPrivacy, setMaskingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Handle Missing Data Analysis
  const handleAnalyzeMissing = async () => {
    if (!activeDataset) return;
    setLoadingRecommendations(true);
    setRecommendationsError(null);
    setImputeSuccess(null);
    try {
      const res = await getCleaningRecommendations(activeDataset.id);
      setRecommendations(res.recommendations);
    } catch (err: any) {
      setRecommendationsError(err.message || 'Failed to fetch recommendations.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Handle Imputation Application
  const handleApplyImputations = async () => {
    if (!activeDataset) return;
    setApplyingImpute(true);
    setRecommendationsError(null);
    setImputeSuccess(null);
    try {
      const res = await applyImputation(activeDataset.id);
      setImputeSuccess(
        res.message || 'Successfully applied recommended imputations to all null values!'
      );
      if (res.dataset) {
        onDatasetUpdated(res.dataset);
      }
      // Re-run recommendation analysis to show updated zero-missing status
      const updated = await getCleaningRecommendations(activeDataset.id);
      setRecommendations(updated.recommendations);
    } catch (err: any) {
      setRecommendationsError(err.message || 'Failed to apply imputations.');
    } finally {
      setApplyingImpute(false);
    }
  };

  // Handle Outlier Treatment
  const handleApplyOutliers = async () => {
    if (!activeDataset) return;
    if (selectedOutlierCols.length === 0) {
      setOutlierError('Please select at least one numeric column for outlier treatment.');
      return;
    }

    setApplyingOutliers(true);
    setOutlierError(null);
    try {
      const res = await applyOutlierTreatment(
        activeDataset.id,
        outlierMethod,
        selectedOutlierCols
      );
      setOutlierResult(res);
      if (res.dataset) {
        onDatasetUpdated(res.dataset);
      }
    } catch (err: any) {
      setOutlierError(err.message || 'Failed to apply outlier treatment.');
    } finally {
      setApplyingOutliers(false);
    }
  };

  const toggleOutlierCol = (col: string) => {
    if (selectedOutlierCols.includes(col)) {
      setSelectedOutlierCols(selectedOutlierCols.filter((c) => c !== col));
    } else {
      setSelectedOutlierCols([...selectedOutlierCols, col]);
    }
  };

  const selectAllNumericForOutliers = () => {
    if (!activeDataset) return;
    if (selectedOutlierCols.length === activeDataset.numeric_columns.length) {
      setSelectedOutlierCols([]);
    } else {
      setSelectedOutlierCols([...activeDataset.numeric_columns]);
    }
  };

  // Handle Privacy Scan
  const handleScanPrivacy = async () => {
    if (!activeDataset) return;
    setLoadingPrivacy(true);
    setPrivacyError(null);
    setPrivacySuccess(null);
    try {
      const res = await scanPrivacy(activeDataset.id);
      setPrivacyResults(res.scan_results);
      setTotalPii(res.total_pii_found);
      setIsMasked(res.masked);
    } catch (err: any) {
      setPrivacyError(err.message || 'Failed to scan dataset for PII.');
    } finally {
      setLoadingPrivacy(false);
    }
  };

  // Handle Privacy Masking
  const handleMaskPrivacy = async () => {
    if (!activeDataset) return;
    setMaskingPrivacy(true);
    setPrivacyError(null);
    setPrivacySuccess(null);
    try {
      const res = await maskPrivacy(activeDataset.id);
      setPrivacyResults(res.scan_results);
      setTotalPii(res.total_pii_found);
      setIsMasked(true);
      setPrivacySuccess('Successfully anonymized and masked all detected emails and phone numbers!');
    } catch (err: any) {
      setPrivacyError(err.message || 'Failed to mask PII.');
    } finally {
      setMaskingPrivacy(false);
    }
  };

  // Handle Dataset Export
  const handleExport = async () => {
    if (!activeDataset) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const filename = `cleaned_${activeDataset.filename.replace(/\.[^/.]+$/, '')}.csv`;
      await exportDataset(activeDataset.id, filename);
    } catch (err: any) {
      setExportError(err.message || 'Failed to export cleaned dataset.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="py-16 text-center">
        <Card className="max-w-md mx-auto border-slate-800 bg-slate-900/60 p-8">
          <Sliders className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-100">No Active Dataset Selected</h3>
          <p className="text-sm text-slate-400 mt-2">
            Please select an existing dataset or upload a new file to execute smart imputation,
            outlier capping/pruning, and PII masking.
          </p>
          <Button onClick={onNavigateToUpload} className="mt-6 w-full">
            Go to Upload & Registry
          </Button>
        </Card>
      </div>
    );
  }

  // Safe accessor for outlier summaries
  const outlierSummaries = outlierResult?.summaries || (outlierResult?.details ? Object.values(outlierResult.details) : []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Active Dataset Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Active Dataset for Cleaning
              </span>
              <Badge variant="success">ID #{activeDataset.id}</Badge>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{activeDataset.filename}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            onClick={handleExport}
            isLoading={isExporting}
            className="shadow-lg shadow-cyan-500/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Cleaned CSV
          </Button>
        </div>
      </div>

      {exportError && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Export Error</AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}

      {/* 1. Missing Data & Smart Imputation Section */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-cyan-400" />
              Smart Imputation & Missing Value Resolution
            </CardTitle>
            <CardDescription className="text-slate-400">
              Skewness-aware imputation recommendations: uses mean for normal distributions (|skew| ≤ 1.0),
              median for skewed features (|skew| &gt; 1.0), and mode for categorical columns.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyzeMissing}
              isLoading={loadingRecommendations}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Analyze Missing Data
            </Button>
            {recommendations.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyImputations}
                isLoading={applyingImpute}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Apply All Imputations
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {imputeSuccess && (
            <Alert variant="success">
              <CheckCircle2 className="w-4 h-4" />
              <AlertTitle>Imputation Complete</AlertTitle>
              <AlertDescription>{imputeSuccess}</AlertDescription>
            </Alert>
          )}

          {recommendationsError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Recommendation Analysis Failed</AlertTitle>
              <AlertDescription>{recommendationsError}</AlertDescription>
            </Alert>
          )}

          {recommendations.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FileCheck className="w-10 h-10 text-teal-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium text-slate-300">
                Click &quot;Analyze Missing Data&quot; to inspect null counts and generate statistical strategies.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-950/80">
                    <TableHead>Column Name</TableHead>
                    <TableHead className="text-right">Missing Rows</TableHead>
                    <TableHead className="text-right">Missing %</TableHead>
                    <TableHead className="text-right">Skewness</TableHead>
                    <TableHead>Recommended Method</TableHead>
                    <TableHead>Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => {
                    const hasMissing = rec.missing_count > 0;
                    return (
                      <TableRow key={rec.column_name} className="hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-semibold text-slate-100">
                          {rec.column_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasMissing ? (
                            <span className="text-rose-400 font-bold">{rec.missing_count}</span>
                          ) : (
                            <span className="text-teal-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {rec.missing_pct > 0 ? (
                            <span className="text-rose-400">{rec.missing_pct.toFixed(2)}%</span>
                          ) : (
                            <span className="text-teal-400">0.00%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-300">
                          {rec.skewness !== null && rec.skewness !== undefined
                            ? rec.skewness.toFixed(3)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rec.recommended_method === 'median'
                                ? 'warning'
                                : rec.recommended_method === 'mean'
                                ? 'default'
                                : 'secondary'
                            }
                            className="uppercase text-[10px]"
                          >
                            {rec.recommended_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 max-w-xs font-sans text-xs">
                          {rec.reason}
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

      {/* 2. Outlier Treatment Section */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Scissors className="w-5 h-5 text-cyan-400" />
            Outlier Treatment (Tukey&apos;s 1.5×IQR Rule)
          </CardTitle>
          <CardDescription className="text-slate-400">
            Cap extreme values to the IQR fences (Winsorization) or prune entire rows containing severe
            multivariate outliers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column selection */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Select Numeric Columns for Treatment:
                </label>
                <button
                  type="button"
                  onClick={selectAllNumericForOutliers}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline"
                >
                  {selectedOutlierCols.length === activeDataset.numeric_columns.length
                    ? 'Deselect All'
                    : 'Select All Numeric'}
                </button>
              </div>
              <div className="flex flex-wrap gap-3 max-h-36 overflow-y-auto p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                {activeDataset.numeric_columns.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No numeric columns available.</span>
                ) : (
                  activeDataset.numeric_columns.map((col) => (
                    <Checkbox
                      key={col}
                      label={col}
                      checked={selectedOutlierCols.includes(col)}
                      onCheckedChange={() => toggleOutlierCol(col)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Treatment Method & Action */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Outlier Handling Strategy:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="outlierMethod"
                      value="cap"
                      checked={outlierMethod === 'cap'}
                      onChange={() => setOutlierMethod('cap')}
                      className="text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-200 block">
                        Cap (Winsorize)
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Clamp extreme values to upper/lower fences
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="outlierMethod"
                      value="prune"
                      checked={outlierMethod === 'prune'}
                      onChange={() => setOutlierMethod('prune')}
                      className="text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-200 block">
                        Prune (Remove Rows)
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Delete rows exceeding 1.5×IQR threshold
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleApplyOutliers}
                disabled={applyingOutliers || selectedOutlierCols.length === 0}
                isLoading={applyingOutliers}
                className="w-full"
              >
                Apply Treatment ({selectedOutlierCols.length} Columns)
              </Button>
            </div>
          </div>

          {outlierError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Outlier Treatment Error</AlertTitle>
              <AlertDescription>{outlierError}</AlertDescription>
            </Alert>
          )}

          {/* Outlier Summary Card */}
          {outlierResult && (
            <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Treatment Execution Summary
                </span>
                <Badge variant="default" className="capitalize">
                  Method: {outlierResult.method || outlierMethod}
                </Badge>
              </div>

              {outlierResult.message && (
                <p className="text-xs text-teal-300 font-medium">{outlierResult.message}</p>
              )}

              {outlierSummaries.length > 0 && (
                <div className="rounded-lg border border-slate-800 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-900 text-xs">
                        <TableHead>Column</TableHead>
                        <TableHead className="text-right">Q1 (25%)</TableHead>
                        <TableHead className="text-right">Q3 (75%)</TableHead>
                        <TableHead className="text-right">IQR</TableHead>
                        <TableHead className="text-right">Lower Fence</TableHead>
                        <TableHead className="text-right">Upper Fence</TableHead>
                        <TableHead className="text-right">Affected Values</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outlierSummaries.map((summary, idx) => (
                        <TableRow key={idx} className="font-mono text-xs hover:bg-slate-800/40">
                          <TableCell className="font-semibold text-cyan-300">
                            {summary.column}
                          </TableCell>
                          <TableCell className="text-right">{summary.q1.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{summary.q3.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-slate-400">
                            {summary.iqr.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-amber-400">
                            {summary.lower_fence.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-amber-400">
                            {summary.upper_fence.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-400">
                            {summary.affected_count.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Privacy & PII Section */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              Privacy Compliance & PII Anonymization
            </CardTitle>
            <CardDescription className="text-slate-400">
              Regex-powered scanning for sensitive Personally Identifiable Information (emails, phone
              numbers) and automated redaction masking.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanPrivacy}
              isLoading={loadingPrivacy}
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Scan for PII
            </Button>
            {privacyResults && totalPii > 0 && !isMasked && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleMaskPrivacy}
                isLoading={maskingPrivacy}
              >
                <Lock className="w-3.5 h-3.5 mr-1" /> Mask All PII
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacySuccess && (
            <Alert variant="success">
              <ShieldCheck className="w-4 h-4" />
              <AlertTitle>PII Masked Successfully</AlertTitle>
              <AlertDescription>{privacySuccess}</AlertDescription>
            </Alert>
          )}

          {privacyError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Privacy Scan Error</AlertTitle>
              <AlertDescription>{privacyError}</AlertDescription>
            </Alert>
          )}

          {!privacyResults ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <ShieldAlert className="w-10 h-10 text-cyan-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium text-slate-300">
                Click &quot;Scan for PII&quot; to inspect all columns for email addresses and phone numbers.
              </p>
            </div>
          ) : privacyResults.length === 0 || totalPii === 0 ? (
            <Alert variant="success">
              <ShieldCheck className="w-5 h-5" />
              <AlertTitle>No PII Detected</AlertTitle>
              <AlertDescription>
                Clean scan. No email patterns or phone number formats were detected across any dataset columns.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs">
                <span className="font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Sensitive Data Found: {totalPii} PII instance(s) detected across columns.
                </span>
                {isMasked ? (
                  <Badge variant="success">Masked / Redacted</Badge>
                ) : (
                  <Badge variant="warning">Unmasked / Sensitive</Badge>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-950/80 text-xs">
                      <TableHead>Column Name</TableHead>
                      <TableHead className="text-right">Emails Detected</TableHead>
                      <TableHead className="text-right">Phones Detected</TableHead>
                      <TableHead className="text-right">Total PII Count</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {privacyResults
                      .filter((r) => r.total_pii > 0)
                      .map((res) => (
                        <TableRow key={res.column_name} className="font-mono text-xs hover:bg-slate-800/40">
                          <TableCell className="font-semibold text-slate-100">
                            {res.column_name}
                          </TableCell>
                          <TableCell className="text-right text-cyan-300">
                            {res.emails_found}
                          </TableCell>
                          <TableCell className="text-right text-cyan-300">
                            {res.phones_found}
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-400">
                            {res.total_pii}
                          </TableCell>
                          <TableCell className="text-right">
                            {isMasked ? (
                              <Badge variant="success" className="text-[10px]">
                                Masked
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Exposed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
