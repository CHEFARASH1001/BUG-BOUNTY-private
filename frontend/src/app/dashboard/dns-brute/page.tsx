'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Play,
  Square,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  FileText,
  Globe,
  Database,
  Settings,
  Download,
  RefreshCw,
  Trash2,
  Eye,
  Copy,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Zap,
} from 'lucide-react';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { dnsBruteApi, wordlistsApi } from '@/lib/api';
import { socketClient, useSocket } from '@/lib/socket';

interface WordlistInfo {
  name: string;
  path: string;
  lineCount: number;
  sizeBytes: number;
  lastUpdated: string;
  source: string;
  isReady: boolean;
}

interface DNSBruteJob {
  _id: string;
  domain: string;
  mode: 'static' | 'dynamic';
  wordlistConfig: {
    sources: {
      bestDns?: boolean;
      twoMillionSubdomains?: boolean;
      crunch?: boolean;
      custom?: string[];
    };
    crunchConfig?: {
      minLength: number;
      maxLength: number;
      charset: string;
    };
  };
  threads: number;
  status: 'pending' | 'preparing' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  discoveredCount: number;
  results: string[];
  logs: string[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  preparing: { icon: Settings, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Preparing' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Cancelled' },
};


export default function DNSBrutePage() {
  // Form state
  const [domain, setDomain] = useState('');
  const [mode, setMode] = useState<'static' | 'dynamic'>('static');
  const [threads, setThreads] = useState('200');
  const [useBestDns, setUseBestDns] = useState(true);
  const [useTwoMillion, setUseTwoMillion] = useState(false);
  const [useCrunch, setUseCrunch] = useState(true);
  const [crunchMinLen, setCrunchMinLen] = useState('1');
  const [crunchMaxLen, setCrunchMaxLen] = useState('4');
  const [crunchCharset, setCrunchCharset] = useState('abcdefghijklmnopqrstuvwxyz0123456789');

  // UI state
  const [wordlists, setWordlists] = useState<WordlistInfo[]>([]);
  const [jobs, setJobs] = useState<DNSBruteJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<DNSBruteJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [resultFilter, setResultFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedResults, setCopiedResults] = useState(false);

  // Fetch wordlists and jobs on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [wordlistsRes, jobsRes] = await Promise.all([
          wordlistsApi.getAll(),
          dnsBruteApi.getHistory(20),
        ]);
        setWordlists(wordlistsRes.data.wordlists || []);
        setJobs(jobsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Poll for job updates
  useEffect(() => {
    const hasRunningJobs = jobs.some(j => 
      j.status === 'running' || j.status === 'pending' || j.status === 'preparing'
    );
    if (!hasRunningJobs) return;

    const interval = setInterval(async () => {
      try {
        const jobsRes = await dnsBruteApi.getHistory(20);
        setJobs(jobsRes.data || []);
        
        // Update selected job if it's running
        if (selectedJob && ['running', 'pending', 'preparing'].includes(selectedJob.status)) {
          const updatedJob = await dnsBruteApi.getJob(selectedJob._id);
          setSelectedJob(updatedJob.data);
        }
      } catch (err) {
        console.error('Failed to poll jobs:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, selectedJob]);

  // WebSocket subscription for real-time updates
  useSocket('dns-brute:progress', useCallback((data: any) => {
    if (selectedJob && data.jobId === selectedJob._id) {
      setSelectedJob(prev => prev ? { ...prev, progress: data.progress, discoveredCount: data.discoveredCount } : null);
    }
    setJobs(prev => prev.map(j => 
      j._id === data.jobId ? { ...j, progress: data.progress, discoveredCount: data.discoveredCount } : j
    ));
  }, [selectedJob]));

  useSocket('dns-brute:result', useCallback((data: any) => {
    if (selectedJob && data.jobId === selectedJob._id) {
      setSelectedJob(prev => prev ? { 
        ...prev, 
        results: [...(prev.results || []), data.subdomain],
        discoveredCount: (prev.discoveredCount || 0) + 1
      } : null);
    }
  }, [selectedJob]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;

    setSubmitting(true);
    try {
      const config: any = {
        domain,
        mode,
        threads: parseInt(threads) || 200,
      };

      if (mode === 'static') {
        config.wordlistConfig = {
          sources: {
            bestDns: useBestDns,
            twoMillionSubdomains: useTwoMillion,
            crunch: useCrunch,
          },
        };
        if (useCrunch) {
          config.wordlistConfig.crunchConfig = {
            minLength: parseInt(crunchMinLen) || 1,
            maxLength: parseInt(crunchMaxLen) || 4,
            charset: crunchCharset,
          };
        }
      }

      const response = await dnsBruteApi.start(config);
      setJobs(prev => [response.data, ...prev]);
      setSelectedJob(response.data);
      setShowForm(false);
      
      // Reset form
      setDomain('');
    } catch (err) {
      console.error('Failed to start DNS brute job:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await dnsBruteApi.cancel(jobId);
      const jobsRes = await dnsBruteApi.getHistory(20);
      setJobs(jobsRes.data || []);
      if (selectedJob?._id === jobId) {
        const updatedJob = await dnsBruteApi.getJob(jobId);
        setSelectedJob(updatedJob.data);
      }
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handleViewJob = async (job: DNSBruteJob) => {
    try {
      const response = await dnsBruteApi.getJob(job._id);
      setSelectedJob(response.data);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to fetch job:', err);
    }
  };

  const handleCopyResults = () => {
    if (selectedJob?.results) {
      navigator.clipboard.writeText(selectedJob.results.join('\n'));
      setCopiedResults(true);
      setTimeout(() => setCopiedResults(false), 2000);
    }
  };

  const handleExportResults = () => {
    if (selectedJob?.results) {
      const blob = new Blob([selectedJob.results.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dns-brute-${selectedJob.domain}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const filteredResults = selectedJob?.results?.filter(r => {
    if (!resultFilter) return true;
    return r.toLowerCase().includes(resultFilter.toLowerCase());
  }) || [];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="w-7 h-7 text-primary-400" />
            DNS Brute Force
          </h1>
          <p className="text-slate-400 mt-1">Discover subdomains through DNS brute forcing</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSelectedJob(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, icon: Database, color: 'text-primary-400' },
          { label: 'Running', value: jobs.filter(j => ['running', 'preparing'].includes(j.status)).length, icon: Loader2, color: 'text-blue-400' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Discovered', value: jobs.reduce((acc, j) => acc + (j.discoveredCount || 0), 0), icon: Globe, color: 'text-yellow-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatNumber(stat.value)}</p>
              </div>
              <stat.icon className={cn('w-8 h-8', stat.color, stat.label === 'Running' && 'animate-spin')} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Form or Job Details */}
        <div className="lg:col-span-2">
          {showForm ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              <h2 className="text-lg font-semibold text-white mb-4">New DNS Brute Job</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Domain Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Target Domain <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="example.com"
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Brute Force Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('static')}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        mode === 'static'
                          ? 'bg-primary-500/20 border-primary-500/50 text-white'
                          : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">Static</span>
                      </div>
                      <p className="text-xs text-slate-500">Use pre-built wordlists</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('dynamic')}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        mode === 'dynamic'
                          ? 'bg-primary-500/20 border-primary-500/50 text-white'
                          : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="font-medium">Dynamic</span>
                      </div>
                      <p className="text-xs text-slate-500">Generate permutations</p>
                    </button>
                  </div>
                </div>

                {/* Static Mode Options */}
                {mode === 'static' && (
                  <div className="border-t border-dark-700 pt-4">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Wordlist Sources</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useBestDns}
                          onChange={(e) => setUseBestDns(e.target.checked)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50"
                        />
                        <div>
                          <span className="text-sm text-white">Best DNS Wordlist</span>
                          <p className="text-xs text-slate-500">Assetnote's curated DNS wordlist</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useTwoMillion}
                          onChange={(e) => setUseTwoMillion(e.target.checked)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50"
                        />
                        <div>
                          <span className="text-sm text-white">2M Subdomains</span>
                          <p className="text-xs text-slate-500">Large subdomain wordlist (slower)</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCrunch}
                          onChange={(e) => setUseCrunch(e.target.checked)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50"
                        />
                        <div>
                          <span className="text-sm text-white">Character Combinations</span>
                          <p className="text-xs text-slate-500">Generate short combinations using crunch</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Advanced Options */}
                <div className="border-t border-dark-700 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Advanced Options
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Threads</label>
                        <input
                          type="number"
                          value={threads}
                          onChange={(e) => setThreads(e.target.value)}
                          placeholder="200"
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                        />
                        <p className="text-xs text-slate-500 mt-1">Number of concurrent DNS queries</p>
                      </div>
                      
                      {mode === 'static' && useCrunch && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Min Length</label>
                              <input
                                type="number"
                                value={crunchMinLen}
                                onChange={(e) => setCrunchMinLen(e.target.value)}
                                min="1"
                                max="4"
                                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Max Length</label>
                              <input
                                type="number"
                                value={crunchMaxLen}
                                onChange={(e) => setCrunchMaxLen(e.target.value)}
                                min="1"
                                max="4"
                                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Character Set</label>
                            <input
                              type="text"
                              value={crunchCharset}
                              onChange={(e) => setCrunchCharset(e.target.value)}
                              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors font-mono"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !domain}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start DNS Brute Force
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : selectedJob ? (
            <JobDetailsPanel
              job={selectedJob}
              filteredResults={filteredResults}
              resultFilter={resultFilter}
              setResultFilter={setResultFilter}
              onCancel={handleCancel}
              onNewJob={() => { setShowForm(true); setSelectedJob(null); }}
              onCopyResults={handleCopyResults}
              onExportResults={handleExportResults}
              copiedResults={copiedResults}
            />
          ) : null}
        </div>

        {/* Right Panel - Job History & Wordlists */}
        <div className="lg:col-span-1 space-y-6">
          {/* Wordlists Status */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-400" />
              Available Wordlists
            </h3>
            {wordlists.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No wordlists available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {wordlists.slice(0, 5).map((wl) => (
                  <div key={wl.name} className="p-2 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white truncate">{wl.name}</span>
                      {wl.isReady ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{formatNumber(wl.lineCount)} lines</span>
                      <span>{formatBytes(wl.sizeBytes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job History */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <h3 className="text-sm font-medium text-white mb-3">Recent Jobs</h3>
            {!mounted || loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {jobs.map((job) => {
                  const status = statusConfig[job.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const isSelected = selectedJob?._id === job._id;

                  return (
                    <button
                      key={job._id}
                      onClick={() => handleViewJob(job)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        isSelected
                          ? 'bg-primary-500/20 border-primary-500/30'
                          : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{job.domain}</p>
                          <p className="text-xs text-slate-500 mt-1 capitalize">{job.mode} mode</p>
                        </div>
                        <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-xs shrink-0', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', ['running', 'preparing'].includes(job.status) && 'animate-spin')} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(job.createdAt)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {job.discoveredCount || 0} found
                        </span>
                      </div>
                      {['running', 'preparing'].includes(job.status) && (
                        <div className="mt-2">
                          <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary-500 transition-all duration-300"
                              style={{ width: `${job.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// Job Details Panel Component
function JobDetailsPanel({
  job,
  filteredResults,
  resultFilter,
  setResultFilter,
  onCancel,
  onNewJob,
  onCopyResults,
  onExportResults,
  copiedResults,
}: {
  job: DNSBruteJob;
  filteredResults: string[];
  resultFilter: string;
  setResultFilter: (value: string) => void;
  onCancel: (jobId: string) => void;
  onNewJob: () => void;
  onCopyResults: () => void;
  onExportResults: () => void;
  copiedResults: boolean;
}) {
  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
    >
      {/* Job Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white break-all">{job.domain}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-400 capitalize">{job.mode} mode</span>
            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', status.bg, status.color)}>
              <StatusIcon className={cn('w-3 h-3', ['running', 'preparing'].includes(job.status) && 'animate-spin')} />
              {status.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['running', 'preparing', 'pending'].includes(job.status) && (
            <button
              onClick={() => onCancel(job._id)}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Cancel"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onNewJob}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="New Job"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {['running', 'preparing'].includes(job.status) && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{job.status === 'preparing' ? 'Preparing wordlists...' : 'Brute forcing...'}</span>
            <span>{job.progress || 0}%</span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Job Info */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-dark-800/50 rounded-lg">
        <div>
          <p className="text-xs text-slate-500">Started</p>
          <p className="text-sm text-white">{job.startedAt ? formatDateTime(job.startedAt) : '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-sm text-white">{job.completedAt ? formatDateTime(job.completedAt) : '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Discovered</p>
          <p className="text-sm text-white font-medium">{job.discoveredCount || 0}</p>
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="mb-4 p-3 bg-dark-800/50 rounded-lg">
        <p className="text-xs text-slate-500 mb-2">Configuration</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-dark-700 rounded text-xs text-slate-300">
            {job.threads} threads
          </span>
          {job.mode === 'static' && job.wordlistConfig?.sources && (
            <>
              {job.wordlistConfig.sources.bestDns && (
                <span className="px-2 py-1 bg-dark-700 rounded text-xs text-slate-300">Best DNS</span>
              )}
              {job.wordlistConfig.sources.twoMillionSubdomains && (
                <span className="px-2 py-1 bg-dark-700 rounded text-xs text-slate-300">2M Subdomains</span>
              )}
              {job.wordlistConfig.sources.crunch && (
                <span className="px-2 py-1 bg-dark-700 rounded text-xs text-slate-300">Crunch</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Results Section */}
      {job.results && job.results.length > 0 && (
        <>
          {/* Results Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">
              Results ({job.results.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onCopyResults}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                title="Copy all results"
              >
                <Copy className="w-3 h-3" />
                {copiedResults ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={onExportResults}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                title="Export results"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
          </div>

          {/* Results Filter */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                placeholder="Filter results..."
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-[400px] overflow-y-auto bg-dark-800/50 rounded-lg">
            {filteredResults.map((subdomain, index) => (
              <div
                key={index}
                className="px-3 py-2 border-b border-dark-700 last:border-b-0 hover:bg-dark-700/50 transition-colors"
              >
                <span className="text-sm text-white font-mono">{subdomain}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Running State */}
      {['running', 'preparing'].includes(job.status) && (
        <div className="mb-4">
          <div className="flex flex-col items-center justify-center py-6">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-4" />
            <p className="text-slate-400">
              {job.status === 'preparing' ? 'Preparing wordlists...' : 'DNS brute forcing in progress...'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {job.discoveredCount || 0} subdomains discovered so far
            </p>
          </div>
          
          {/* Logs Section */}
          {job.logs && job.logs.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Execution Logs</h4>
              <div className="max-h-[200px] overflow-y-auto bg-dark-800/50 rounded-lg p-3 font-mono text-xs">
                {job.logs.map((log, index) => (
                  <div key={index} className="text-slate-300 py-0.5">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {job.status === 'completed' && (!job.results || job.results.length === 0) && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No subdomains discovered</p>
          
          {/* Show logs even when completed with no results */}
          {job.logs && job.logs.length > 0 && (
            <div className="mt-4 text-left">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Execution Logs</h4>
              <div className="max-h-[200px] overflow-y-auto bg-dark-800/50 rounded-lg p-3 font-mono text-xs">
                {job.logs.map((log, index) => (
                  <div key={index} className="text-slate-300 py-0.5">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {job.error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{job.error}</p>
        </div>
      )}

      {/* Logs for failed/completed jobs */}
      {['failed', 'completed', 'cancelled'].includes(job.status) && job.logs && job.logs.length > 0 && job.results && job.results.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Execution Logs</h4>
          <div className="max-h-[150px] overflow-y-auto bg-dark-800/50 rounded-lg p-3 font-mono text-xs">
            {job.logs.map((log, index) => (
              <div key={index} className="text-slate-300 py-0.5">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
