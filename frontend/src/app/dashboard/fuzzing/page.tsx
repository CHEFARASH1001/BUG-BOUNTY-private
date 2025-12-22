'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Play,
  Square,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Trash2,
  Plus,
  FileText,
  Link as LinkIcon,
  Hash,
  AlignLeft,
  Maximize2,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { fuzzApi } from '@/lib/api';

interface FuzzResult {
  url: string;
  status: number;
  length: number;
  words: number;
  lines: number;
  contentType: string;
  redirectLocation?: string;
}

interface FuzzJob {
  _id: string;
  url: string;
  wordlist: string;
  extensions: string[];
  filters: {
    matchCodes?: number[];
    filterWords?: number;
    filterLines?: number;
    filterSize?: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  results: FuzzResult[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Cancelled' },
};

const statusCodeColors: Record<string, string> = {
  '2': 'text-green-400 bg-green-500/20',
  '3': 'text-blue-400 bg-blue-500/20',
  '4': 'text-yellow-400 bg-yellow-500/20',
  '5': 'text-red-400 bg-red-500/20',
};

export default function FuzzingPage() {
  // Form state
  const [url, setUrl] = useState('');
  const [wordlist, setWordlist] = useState('');
  const [extensions, setExtensions] = useState('');
  const [matchCodes, setMatchCodes] = useState('');
  const [filterWords, setFilterWords] = useState('');
  const [filterLines, setFilterLines] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [threads, setThreads] = useState('40');
  const [timeout, setTimeout] = useState('10');

  // UI state
  const [wordlists, setWordlists] = useState<string[]>([]);
  const [jobs, setJobs] = useState<FuzzJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FuzzJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [resultFilter, setResultFilter] = useState('');

  // Fetch wordlists and jobs on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [wordlistsRes, jobsRes] = await Promise.all([
          fuzzApi.getWordlists(),
          fuzzApi.getJobs(),
        ]);
        setWordlists(wordlistsRes.data.wordlists || []);
        setJobs(jobsRes.data || []);
        if (wordlistsRes.data.wordlists?.length > 0 && !wordlist) {
          setWordlist(wordlistsRes.data.wordlists[0]);
        }
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
    const hasRunningJobs = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasRunningJobs) return;

    const interval = setInterval(async () => {
      try {
        const jobsRes = await fuzzApi.getJobs();
        setJobs(jobsRes.data || []);
        
        // Update selected job if it's running
        if (selectedJob && (selectedJob.status === 'running' || selectedJob.status === 'pending')) {
          const updatedJob = await fuzzApi.getJob(selectedJob._id);
          setSelectedJob(updatedJob.data);
        }
      } catch (err) {
        console.error('Failed to poll jobs:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, selectedJob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !wordlist) return;

    setSubmitting(true);
    try {
      const config: any = {
        url,
        wordlist,
      };

      if (extensions.trim()) {
        config.extensions = extensions.split(',').map(e => e.trim()).filter(Boolean);
      }
      if (matchCodes.trim()) {
        config.matchCodes = matchCodes.split(',').map(c => parseInt(c.trim())).filter(n => !isNaN(n));
      }
      if (filterWords.trim()) {
        config.filterWords = parseInt(filterWords);
      }
      if (filterLines.trim()) {
        config.filterLines = parseInt(filterLines);
      }
      if (filterSize.trim()) {
        config.filterSize = parseInt(filterSize);
      }
      if (threads.trim()) {
        config.threads = parseInt(threads);
      }
      if (timeout.trim()) {
        config.timeout = parseInt(timeout);
      }

      const response = await fuzzApi.start(config);
      setJobs(prev => [response.data, ...prev]);
      setSelectedJob(response.data);
      setShowForm(false);
      
      // Reset form
      setUrl('');
      setExtensions('');
      setMatchCodes('');
      setFilterWords('');
      setFilterLines('');
      setFilterSize('');
    } catch (err) {
      console.error('Failed to start fuzzing job:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await fuzzApi.cancel(jobId);
      const jobsRes = await fuzzApi.getJobs();
      setJobs(jobsRes.data || []);
      if (selectedJob?._id === jobId) {
        const updatedJob = await fuzzApi.getJob(jobId);
        setSelectedJob(updatedJob.data);
      }
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handleViewJob = async (job: FuzzJob) => {
    try {
      const response = await fuzzApi.getJob(job._id);
      setSelectedJob(response.data);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to fetch job:', err);
    }
  };

  const getStatusCodeColor = (status: number) => {
    const firstDigit = Math.floor(status / 100).toString();
    return statusCodeColors[firstDigit] || 'text-slate-400 bg-slate-500/20';
  };

  const filteredResults = selectedJob?.results?.filter(r => {
    if (!resultFilter) return true;
    return r.url.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.status.toString().includes(resultFilter) ||
           r.contentType?.toLowerCase().includes(resultFilter.toLowerCase());
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-7 h-7 text-primary-400" />
            Fuzzing
          </h1>
          <p className="text-slate-400 mt-1">Discover hidden files and directories with FFUF</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSelectedJob(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Fuzz Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, icon: Zap, color: 'text-primary-400' },
          { label: 'Running', value: jobs.filter(j => j.status === 'running').length, icon: Loader2, color: 'text-blue-400' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Findings', value: jobs.reduce((acc, j) => acc + (j.results?.length || 0), 0), icon: FileText, color: 'text-yellow-400' },
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
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
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
              <h2 className="text-lg font-semibold text-white mb-4">New Fuzzing Job</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Target URL <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/FUZZ or https://example.com/"
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Use FUZZ as placeholder for wordlist injection</p>
                </div>

                {/* Wordlist Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Wordlist <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={wordlist}
                    onChange={(e) => setWordlist(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 transition-colors"
                    required
                  >
                    <option value="">Select a wordlist</option>
                    {wordlists.map((wl) => (
                      <option key={wl} value={wl}>{wl}</option>
                    ))}
                  </select>
                </div>

                {/* Extensions */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Extensions
                  </label>
                  <input
                    type="text"
                    value={extensions}
                    onChange={(e) => setExtensions(e.target.value)}
                    placeholder=".php, .html, .js, .txt"
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-1">Comma-separated file extensions to append</p>
                </div>

                {/* Filter Options */}
                <div className="border-t border-dark-700 pt-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter Options
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Match Status Codes</label>
                      <input
                        type="text"
                        value={matchCodes}
                        onChange={(e) => setMatchCodes(e.target.value)}
                        placeholder="200, 301, 302"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Filter by Words</label>
                      <input
                        type="number"
                        value={filterWords}
                        onChange={(e) => setFilterWords(e.target.value)}
                        placeholder="Filter word count"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Filter by Lines</label>
                      <input
                        type="number"
                        value={filterLines}
                        onChange={(e) => setFilterLines(e.target.value)}
                        placeholder="Filter line count"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Filter by Size</label>
                      <input
                        type="number"
                        value={filterSize}
                        onChange={(e) => setFilterSize(e.target.value)}
                        placeholder="Filter response size"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-dark-700 pt-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Advanced Options</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Threads</label>
                      <input
                        type="number"
                        value={threads}
                        onChange={(e) => setThreads(e.target.value)}
                        placeholder="40"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={timeout}
                        onChange={(e) => setTimeout(e.target.value)}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !url || !wordlist}
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
                        Start Fuzzing
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : selectedJob ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              {/* Job Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white break-all">{selectedJob.url}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-slate-400">Wordlist: {selectedJob.wordlist}</span>
                    {(() => {
                      const status = statusConfig[selectedJob.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', selectedJob.status === 'running' && 'animate-spin')} />
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedJob.status === 'running' && (
                    <button
                      onClick={() => handleCancel(selectedJob._id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      title="Cancel"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setShowForm(true); setSelectedJob(null); }}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    title="New Job"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Job Info */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-dark-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Started</p>
                  <p className="text-sm text-white">{selectedJob.startedAt ? formatDateTime(selectedJob.startedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Completed</p>
                  <p className="text-sm text-white">{selectedJob.completedAt ? formatDateTime(selectedJob.completedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Results</p>
                  <p className="text-sm text-white font-medium">{selectedJob.results?.length || 0}</p>
                </div>
              </div>

              {/* Results Filter */}
              {selectedJob.results && selectedJob.results.length > 0 && (
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
              )}

              {/* Results Table */}
              {selectedJob.status === 'running' && (!selectedJob.results || selectedJob.results.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-4" />
                  <p className="text-slate-400">Fuzzing in progress...</p>
                </div>
              ) : filteredResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-400">URL</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">Status</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Size</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Words</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Lines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result, index) => (
                        <tr key={index} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="py-2 px-3">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary-400 hover:text-primary-300 break-all"
                            >
                              {result.url}
                            </a>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusCodeColor(result.status))}>
                              {result.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-sm text-slate-300">{result.length}</td>
                          <td className="py-2 px-3 text-right text-sm text-slate-300">{result.words}</td>
                          <td className="py-2 px-3 text-right text-sm text-slate-300">{result.lines}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No results found</p>
                </div>
              )}

              {/* Error Display */}
              {selectedJob.error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{selectedJob.error}</p>
                </div>
              )}
            </motion.div>
          ) : null}
        </div>

        {/* Right Panel - Job History */}
        <div className="lg:col-span-1">
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <h3 className="text-sm font-medium text-white mb-3">Recent Jobs</h3>
            {!mounted || loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                          <p className="text-sm text-white truncate">{job.url}</p>
                          <p className="text-xs text-slate-500 mt-1">{job.wordlist}</p>
                        </div>
                        <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-xs shrink-0', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', job.status === 'running' && 'animate-spin')} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(job.createdAt)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {job.results?.length || 0} results
                        </span>
                      </div>
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
