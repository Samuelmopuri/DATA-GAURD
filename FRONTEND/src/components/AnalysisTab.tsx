import React, { useState, useEffect, useCallback } from 'react';
import type {
  DatasetInfo,
  ProfileResponse,
  TTestResponse,
  ClusterResponse,
  DistributionData,
  PreviewData,
} from '@/types';
import {
  getPreview,
  getProfile,
  runTTest,
  getDistributions,
  runClustering,
} from '@/api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  Table as TableIcon,
  Calculator,
  Network,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

interface AnalysisTabProps {
  activeDataset: DatasetInfo | null;
  onNavigateToUpload: () => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  activeDataset,
  onNavigateToUpload,
}) => {
  // Preview state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Distributions state
  const [distributions, setDistributions] = useState<DistributionData[]>([]);
  const [loadingDistributions, setLoadingDistributions] = useState(false);
  const [selectedDistCol, setSelectedDistCol] = useState<string>('');

  // T-Test state
  const [ttestCol1, setTtestCol1] = useState<string>('');
  const [ttestCol2, setTtestCol2] = useState<string>('');
  const [ttestResult, setTtestResult] = useState<TTestResponse | null>(null);
  const [loadingTtest, setLoadingTtest] = useState(false);
  const [ttestError, setTtestError] = useState<string | null>(null);

  // Clustering state
  const [clusterCols, setClusterCols] = useState<string[]>([]);
  const [clusterK, setClusterK] = useState<number>(3);
  const [clusterResult, setClusterResult] = useState<ClusterResponse | null>(null);
  const [loadingCluster, setLoadingCluster] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

  const numericColumns = activeDataset?.numeric_columns || [];

  const loadData = useCallback(async (datasetId: number) => {
    // 1. Load Preview
    setLoadingPreview(true);
    setPreviewError(null);
    getPreview(datasetId)
      .then((data) => setPreviewData(data))
      .catch((err) => setPreviewError(err.message))
      .finally(() => setLoadingPreview(false));

    // 2. Load Profile
    setLoadingProfile(true);
    setProfileError(null);
    getProfile(datasetId)
      .then((prof) => setProfile(prof))
      .catch((err) => setProfileError(err.message))
      .finally(() => setLoadingProfile(false));

    // 3. Load Distributions
    setLoadingDistributions(true);
    getDistributions(datasetId)
      .then((dists) => {
        setDistributions(dists);
        if (dists.length > 0 && !selectedDistCol) {
          setSelectedDistCol(dists[0].column_name);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDistributions(false));
  }, [selectedDistCol]);

  useEffect(() => {
    if (activeDataset) {
      loadData(activeDataset.id);
      // Reset t-test selections
      if (activeDataset.numeric_columns.length >= 2) {
        setTtestCol1(activeDataset.numeric_columns[0]);
        setTtestCol2(activeDataset.numeric_columns[1]);
      } else if (activeDataset.numeric_columns.length === 1) {
        setTtestCol1(activeDataset.numeric_columns[0]);
        setTtestCol2('');
      } else {
        setTtestCol1('');
        setTtestCol2('');
      }
      // Reset clustering selections to first 2-3 numeric columns
      setClusterCols(activeDataset.numeric_columns.slice(0, 3));
      setTtestResult(null);
      setClusterResult(null);
      setClusterError(null);
      setTtestError(null);
    } else {
      setPreviewData(null);
      setProfile(null);
      setDistributions([]);
      setTtestResult(null);
      setClusterResult(null);
    }
  }, [activeDataset?.id, loadData]);

  // Handle t-test run
  const handleRunTTest = async () => {
    if (!activeDataset) return;
    if (!ttestCol1 || !ttestCol2) {
      setTtestError('Please select two distinct numeric columns for the two-sample t-test.');
      return;
    }
    if (ttestCol1 === ttestCol2) {
      setTtestError('Please select two different columns.');
      return;
    }

    setLoadingTtest(true);
    setTtestError(null);
    try {
      const res = await runTTest(activeDataset.id, ttestCol1, ttestCol2);
      setTtestResult(res);
    } catch (err: any) {
      setTtestError(err.message || 'Failed to execute t-test.');
    } finally {
      setLoadingTtest(false);
    }
  };

  // Handle cluster run
  const handleRunCluster = async () => {
    if (!activeDataset) return;
    if (clusterCols.length < 2) {
      setClusterError('Please select at least 2 numeric features for clustering.');
      return;
    }

    setLoadingCluster(true);
    setClusterError(null);
    try {
      const res = await runClustering(activeDataset.id, clusterCols, clusterK);
      setClusterResult(res);
    } catch (err: any) {
      setClusterError(err.message || 'Failed to execute k-means clustering.');
    } finally {
      setLoadingCluster(false);
    }
  };

  const toggleClusterCol = (col: string) => {
    if (clusterCols.includes(col)) {
      setClusterCols(clusterCols.filter((c) => c !== col));
    } else {
      setClusterCols([...clusterCols, col]);
    }
  };

  if (!activeDataset) {
    return (
      <div className="py-16 text-center">
        <Card className="max-w-md mx-auto border-slate-800 bg-slate-900/60 p-8">
          <BarChart3 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-100">No Active Dataset Selected</h3>
          <p className="text-sm text-slate-400 mt-2">
            Please select an existing dataset from the registry or upload a new file to perform
            profiling, distributions, t-tests, and clustering.
          </p>
          <Button onClick={onNavigateToUpload} className="mt-6 w-full">
            Go to Upload & Registry
          </Button>
        </Card>
      </div>
    );
  }

  const activeDist = distributions.find((d) => d.column_name === selectedDistCol) || distributions[0];

  const formatNumber = (num: number | null | undefined, digits = 3) => {
    if (num === null || num === undefined) return '-';
    return Number(num).toFixed(digits);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner with Active Dataset info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Active Dataset</span>
              <Badge variant="default">#{activeDataset.id}</Badge>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{activeDataset.filename}</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <strong className="text-cyan-400">{activeDataset.row_count.toLocaleString()}</strong> Rows
          </span>
          <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <strong className="text-cyan-400">{activeDataset.col_count}</strong> Columns
          </span>
          <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <strong className="text-cyan-400">{activeDataset.numeric_columns.length}</strong> Numeric
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData(activeDataset.id)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reload
          </Button>
        </div>
      </div>

      {/* 1. Data Preview Section */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-cyan-400" />
              Data Preview (First 100 Rows)
            </CardTitle>
            <CardDescription className="text-slate-400">
              Raw tabular preview of the dataset schema and initial records.
            </CardDescription>
          </div>
          {previewData?.data && (
            <Badge variant="secondary" className="font-mono text-xs">
              Showing {previewData.data.length} records
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loadingPreview ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
              <span>Loading dataset records...</span>
            </div>
          ) : previewError ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Error Loading Preview</AlertTitle>
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          ) : !previewData || previewData.data.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No records available to display.</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-sm">
                    <TableHead className="w-12 text-center text-slate-500">#</TableHead>
                    {previewData.columns.map((col) => (
                      <TableHead key={col} className="font-mono text-xs">
                        <span className="text-slate-200 font-semibold">{col}</span>
                        {activeDataset.numeric_columns.includes(col) && (
                          <span className="ml-1 text-[10px] text-cyan-400 font-normal">num</span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.data.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-800/50 font-mono text-xs">
                      <TableCell className="text-center text-slate-500 select-none">
                        {idx + 1}
                      </TableCell>
                      {previewData.columns.map((col) => (
                        <TableCell key={col} className="truncate max-w-[220px]" title={String(row[col] ?? '')}>
                          {row[col] === null || row[col] === undefined ? (
                            <span className="text-slate-600 italic">null</span>
                          ) : (
                            String(row[col])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Statistical Profile Section */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            Statistical Profile & Dispersion Metrics
          </CardTitle>
          <CardDescription className="text-slate-400">
            Per-column statistical summaries including quartiles (Q1, Q3, IQR), variance, standard deviation,
            and skewness coefficient.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProfile ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
              <span>Computing descriptive statistics...</span>
            </div>
          ) : profileError ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Profile Error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          ) : !profile || profile.columns.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No profile statistics available.</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-950/80">
                    <TableHead>Column</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">Median</TableHead>
                    <TableHead className="text-right">Std Dev</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Q1 (25%)</TableHead>
                    <TableHead className="text-right">Q3 (75%)</TableHead>
                    <TableHead className="text-right">IQR</TableHead>
                    <TableHead className="text-right">Skewness</TableHead>
                    <TableHead className="text-right">Missing (Count / %)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.columns.map((c) => {
                    const isSkewed = c.skewness !== null && Math.abs(c.skewness) > 1.0;
                    const hasMissing = c.missing_count > 0;

                    return (
                      <TableRow key={c.column_name} className="hover:bg-slate-800/40 font-mono text-xs">
                        <TableCell className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {c.column_name}
                          {activeDataset.numeric_columns.includes(c.column_name) ? (
                            <Badge variant="default" className="text-[9px] py-0 px-1">
                              num
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1">
                              cat
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{c.count.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-cyan-300">
                          {formatNumber(c.mean)}
                        </TableCell>
                        <TableCell className="text-right text-cyan-300">
                          {formatNumber(c.median)}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(c.std)}</TableCell>
                        <TableCell className="text-right text-slate-400">
                          {formatNumber(c.variance)}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(c.q1)}</TableCell>
                        <TableCell className="text-right">{formatNumber(c.q3)}</TableCell>
                        <TableCell className="text-right text-slate-300">
                          {formatNumber(c.iqr)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              isSkewed ? 'text-amber-400 font-semibold' : 'text-slate-300'
                            }
                          >
                            {formatNumber(c.skewness)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasMissing ? (
                            <span className="text-rose-400 font-medium">
                              {c.missing_count} ({formatNumber(c.missing_pct, 1)}%)
                            </span>
                          ) : (
                            <span className="text-teal-400">0 (0%)</span>
                          )}
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

      {/* 3. Distribution Charts */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Numeric Column Value Distributions
            </CardTitle>
            <CardDescription className="text-slate-400">
              Binned histograms showing distribution shape and density across feature ranges.
            </CardDescription>
          </div>
          {distributions.length > 0 && (
            <div className="w-64">
              <Select
                value={selectedDistCol || activeDist?.column_name || ''}
                onChange={(e) => setSelectedDistCol(e.target.value)}
              >
                {distributions.map((d) => (
                  <option key={d.column_name} value={d.column_name} className="bg-slate-900 text-slate-100">
                    {d.column_name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingDistributions ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
              <span>Calculating frequency distributions...</span>
            </div>
          ) : distributions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No numeric distributions found for this dataset.
            </div>
          ) : !activeDist ? (
            <div className="py-8 text-center text-slate-400">Select a column to view distribution.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-200">
                  Feature: <span className="text-cyan-400">{activeDist.column_name}</span>
                </span>
                <span>Bins: {activeDist.bins.length}</span>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeDist.bins}
                    margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="range_label"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl text-xs backdrop-blur-sm">
                              <p className="font-bold text-cyan-400">{data.range_label}</p>
                              <p className="text-slate-200 mt-1">
                                Frequency:{' '}
                                <span className="font-mono font-bold text-white">
                                  {data.count.toLocaleString()}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: 4. Hypothesis Testing & 5. Cluster Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 4. Hypothesis Testing Section */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-xl flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                Two-Sample Hypothesis Testing (t-Test)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Independent two-sample Welch t-test (α = 0.05) to evaluate significant differences between means.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Sample 1 (Column A)"
                  value={ttestCol1}
                  onChange={(e) => setTtestCol1(e.target.value)}
                  disabled={numericColumns.length === 0}
                >
                  <option value="">Select column...</option>
                  {numericColumns.map((col) => (
                    <option key={col} value={col} className="bg-slate-900 text-slate-100">
                      {col}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Sample 2 (Column B)"
                  value={ttestCol2}
                  onChange={(e) => setTtestCol2(e.target.value)}
                  disabled={numericColumns.length === 0}
                >
                  <option value="">Select column...</option>
                  {numericColumns.map((col) => (
                    <option key={col} value={col} className="bg-slate-900 text-slate-100">
                      {col}
                    </option>
                  ))}
                </Select>
              </div>

              {ttestError && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Test Execution Error</AlertTitle>
                  <AlertDescription>{ttestError}</AlertDescription>
                </Alert>
              )}

              {/* T-Test Results Card */}
              {ttestResult && (
                <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      t-Test Results (α = {ttestResult.alpha})
                    </span>
                    <Badge variant={ttestResult.reject_null ? 'destructive' : 'success'}>
                      {ttestResult.reject_null ? 'Reject H₀' : 'Fail to Reject H₀'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block">t-Statistic</span>
                      <span className="text-base font-mono font-bold text-cyan-400">
                        {ttestResult.t_statistic.toFixed(4)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block">p-Value</span>
                      <span className="text-base font-mono font-bold text-cyan-400">
                        {ttestResult.p_value < 0.0001
                          ? '< 0.0001'
                          : ttestResult.p_value.toFixed(4)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block">Mean A / B</span>
                      <span className="text-xs font-mono font-medium text-slate-200">
                        {ttestResult.mean1.toFixed(2)} / {ttestResult.mean2.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block">Std Dev A / B</span>
                      <span className="text-xs font-mono font-medium text-slate-200">
                        {ttestResult.std1.toFixed(2)} / {ttestResult.std2.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Interpretation Alert */}
                  <Alert
                    variant={ttestResult.reject_null ? 'warning' : 'success'}
                    className="mt-2"
                  >
                    {ttestResult.reject_null ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    <AlertTitle className="font-semibold">
                      {ttestResult.reject_null
                        ? 'Statistically Significant Difference'
                        : 'No Statistically Significant Difference'}
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                      {ttestResult.interpretation}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </div>
          <div className="p-6 pt-0">
            <Button
              onClick={handleRunTTest}
              disabled={loadingTtest || !ttestCol1 || !ttestCol2 || ttestCol1 === ttestCol2}
              isLoading={loadingTtest}
              className="w-full"
            >
              Run t-Test
            </Button>
          </div>
        </Card>

        {/* 5. Cluster Analysis Section */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-xl flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" />
                Cluster Analysis & Outlier Isolation
              </CardTitle>
              <CardDescription className="text-slate-400">
                K-Means clustering with Euclidean distance thresholding to detect cluster centroids and multidimensional anomalies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Features (Choose 2 or more numeric columns):
                </label>
                <div className="flex flex-wrap gap-3 max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  {numericColumns.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No numeric features detected.</span>
                  ) : (
                    numericColumns.map((col) => (
                      <Checkbox
                        key={col}
                        label={col}
                        checked={clusterCols.includes(col)}
                        onCheckedChange={() => toggleClusterCol(col)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="w-full sm:w-1/2">
                <Select
                  label="Number of Clusters (K)"
                  value={clusterK}
                  onChange={(e) => setClusterK(Number(e.target.value))}
                >
                  <option value={2} className="bg-slate-900 text-slate-100">
                    K = 2
                  </option>
                  <option value={3} className="bg-slate-900 text-slate-100">
                    K = 3
                  </option>
                  <option value={4} className="bg-slate-900 text-slate-100">
                    K = 4
                  </option>
                  <option value={5} className="bg-slate-900 text-slate-100">
                    K = 5
                  </option>
                </Select>
              </div>

              {clusterError && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Clustering Error</AlertTitle>
                  <AlertDescription>{clusterError}</AlertDescription>
                </Alert>
              )}

              {/* Clustering Results */}
              {clusterResult && (
                <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Clustering Summary
                    </span>
                    <Badge
                      variant={clusterResult.outliers.length > 0 ? 'warning' : 'success'}
                      className="font-mono"
                    >
                      {clusterResult.outliers.length} Outliers Detected
                    </Badge>
                  </div>

                  {/* Centroids Table */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-300">Cluster Centers:</span>
                    <div className="rounded-lg border border-slate-800 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-900">
                            <TableHead className="w-16">Cluster</TableHead>
                            {clusterResult.columns.map((c) => (
                              <TableHead key={c} className="font-mono text-xs text-right">
                                {c}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clusterResult.cluster_centers.map((center, cIdx) => (
                            <TableRow key={cIdx} className="font-mono text-xs">
                              <TableCell className="font-bold text-cyan-400">
                                #{cIdx + 1}
                              </TableCell>
                              {center.map((val, vIdx) => (
                                <TableCell key={vIdx} className="text-right text-slate-200">
                                  {Number(val).toFixed(3)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Outlier Records List */}
                  {clusterResult.outliers.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-amber-400">
                          Identified Outlier Row Indices:
                        </span>
                        <span className="text-slate-400 font-mono">
                          Threshold dist: {clusterResult.outlier_threshold.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-900 rounded-lg border border-slate-800">
                        {clusterResult.outliers.map((rowIdx) => (
                          <Badge
                            key={rowIdx}
                            variant="destructive"
                            className="font-mono text-[10px] px-2 py-0.5"
                          >
                            Row #{rowIdx}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </div>
          <div className="p-6 pt-0">
            <Button
              onClick={handleRunCluster}
              disabled={loadingCluster || clusterCols.length < 2}
              isLoading={loadingCluster}
              className="w-full"
            >
              Run Clustering (K={clusterK})
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
