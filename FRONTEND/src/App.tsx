import React, { useState, useEffect, useCallback } from 'react';
import type { DatasetInfo } from '@/types';
import { getDatasets } from '@/api/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UploadTab } from '@/components/UploadTab';
import { AnalysisTab } from '@/components/AnalysisTab';
import { CleaningTab } from '@/components/CleaningTab';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  FileText,
  BarChart3,
  Sliders,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [activeDataset, setActiveDataset] = useState<DatasetInfo | null>(null);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(true);

  // Fetch initial datasets
  const fetchDatasets = useCallback(async () => {
    setIsLoadingDatasets(true);
    try {
      const data = await getDatasets();
      setDatasets(data);
      if (data.length > 0 && !activeDatasetId) {
        setActiveDatasetId(data[0].id);
        setActiveDataset(data[0]);
      }
    } catch {
      // Backend might be warming up or empty
    } finally {
      setIsLoadingDatasets(false);
    }
  }, [activeDatasetId]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Synchronize activeDataset whenever activeDatasetId or datasets list changes
  useEffect(() => {
    if (activeDatasetId !== null) {
      const found = datasets.find((d) => d.id === activeDatasetId) || null;
      setActiveDataset(found);
    } else if (datasets.length > 0) {
      setActiveDatasetId(datasets[0].id);
      setActiveDataset(datasets[0]);
    } else {
      setActiveDataset(null);
    }
  }, [activeDatasetId, datasets]);

  const handleSelectDataset = (dataset: DatasetInfo) => {
    setActiveDatasetId(dataset.id);
    setActiveDataset(dataset);
  };

  const handleDatasetDeleted = (deletedId: number) => {
    const updated = datasets.filter((d) => d.id !== deletedId);
    setDatasets(updated);
    if (activeDatasetId === deletedId) {
      if (updated.length > 0) {
        setActiveDatasetId(updated[0].id);
        setActiveDataset(updated[0]);
      } else {
        setActiveDatasetId(null);
        setActiveDataset(null);
      }
    }
  };

  const handleDatasetUpdated = (updatedDataset: DatasetInfo) => {
    const updated = datasets.map((d) => (d.id === updatedDataset.id ? updatedDataset : d));
    setDatasets(updated);
    if (activeDatasetId === updatedDataset.id) {
      setActiveDataset(updatedDataset);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation / Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-teal-400 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white font-mono">
                  Data<span className="text-cyan-400">Guard</span>
                </h1>
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  v1.0
                </Badge>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Statistical Quality & Duplicate Defense Engine
              </p>
            </div>
          </div>

          {/* Active Dataset Status pill */}
          <div className="flex items-center gap-4">
            {activeDataset ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 hidden md:inline">Active:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[140px]" title={activeDataset.filename}>
                  {activeDataset.filename}
                </span>
                <span className="text-slate-500 font-mono text-[10px]">
                  ({activeDataset.row_count.toLocaleString()} rows)
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500/80 animate-pulse" />
                No active dataset
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <TabsList className="bg-slate-900/90 border-slate-800 p-1">
              <TabsTrigger value="upload" className="flex items-center gap-2 text-xs sm:text-sm">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Upload & Duplicates</span>
                {datasets.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {datasets.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2 text-xs sm:text-sm">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>Analysis & Profiling</span>
              </TabsTrigger>
              <TabsTrigger value="cleaning" className="flex items-center gap-2 text-xs sm:text-sm">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Cleaning & Privacy</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Automated Tukey Fences, Welch t-Test, K-Means & Regex Redaction</span>
            </div>
          </div>

          {/* Tab 1: Upload & Duplicate Detection */}
          <TabsContent value="upload">
            <UploadTab
              datasets={datasets}
              activeDataset={activeDataset}
              onSelectDataset={handleSelectDataset}
              onDatasetsChange={setDatasets}
              onDatasetDeleted={handleDatasetDeleted}
            />
          </TabsContent>

          {/* Tab 2: Statistical Analysis & Profiling */}
          <TabsContent value="analysis">
            <AnalysisTab
              activeDataset={activeDataset}
              onNavigateToUpload={() => setActiveTab('upload')}
            />
          </TabsContent>

          {/* Tab 3: Data Cleaning & Privacy */}
          <TabsContent value="cleaning">
            <CleaningTab
              activeDataset={activeDataset}
              onDatasetUpdated={handleDatasetUpdated}
              onNavigateToUpload={() => setActiveTab('upload')}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DataGuard Statistical Integrity System &copy; 2026</span>
          <span className="font-mono text-[11px] text-slate-400">
            Powered by FastAPI, Scikit-Learn, SciPy & React + Vite
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
