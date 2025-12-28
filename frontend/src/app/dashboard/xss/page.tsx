'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Play,
  Square,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  Link as LinkIcon,
  AlertTriangle,
  Code,
  Copy,
  Check,
  Settings,
  Zap,
  Target,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { xssApi } from '@/lib/api';
import Link from 'next/link';

interface XssResult {
  url: string;
  parameter: string;
  payload: string;
  type: 'reflected' | 'stored' | 'dom';
  context: 'html' | 'attribute' | 'script' | 'url' | 'style';
  evidence?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  wafBypassed?: boolean;
  tool: string;
}

interface ScanLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

interface XssScan {
  _id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: {
    tools: string[];
    wafBypass?: boolean;
    blindXss?: string;
  };
  results: XssResult[];
  logs: ScanLog[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  urlsScanned: number;
  totalUrls: number;
  vulnerabilitiesFound: number;
  currentPhase?: string;
}

interface Tool {
  name: string;
  installed: boolean;
  description: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Cancelled' },
};

const severityConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  info: { color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const contextConfig: Record<string, { label: string; color: string }> = {
  html: { label: 'HTML', color: 'text-orange-400' },
  attribute: { label: 'Attribute', color: 'text-yellow-400' },
  script: { label: 'JavaScript', color: 'text-red-400' },
  url: { label: 'URL', color: 'text-blue-400' },
  style: { label: 'CSS', color: 'text-purple-400' },
};

export default function XssPage() {
  // Form state
  const [url, setUrl] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['builtin']);
  const [wafBypass, setWafBypass] = useState(false);
  const [blindXss, setBlindXss] = useState('');
  const [threads, setThreads] = useState('10');
  const [timeout, setTimeout] = useState('30');
  const [cookies, setCookies] = useState('');
  const [customPayloads, setCustomPayloads] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UI state
  const [tools, setTools] = useState<Tool[]>([]);
  const [scans, setScans] = useState<XssScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<XssScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [resultFilter, setResultFilter] = useState('');
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<string[]>([]);
  const [showPayloads, setShowPayloads] = useState(false);


  // Fetch tools and scans on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [toolsRes, scansRes, payloadsRes] = await Promise.all([
          xssApi.getTools(),
          xssApi.getScans(),
          xssApi.getPayloads('all'),
        ]);
        setTools(toolsRes.data || []);
        setScans(scansRes.data || []);
        setPayloads(payloadsRes.data.payloads || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Poll for scan updates
  useEffect(() => {
    const hasRunningScans = scans.some(s => s.status === 'running' || s.status === 'pending');
    if (!hasRunningScans) return;

    const interval = setInterval(async () => {
      try {
        const scansRes = await xssApi.getScans();
        setScans(scansRes.data || []);
        
        if (selectedScan && (selectedScan.status === 'running' || selectedScan.status === 'pending')) {
          const updatedScan = await xssApi.getScan(selectedScan._id);
          setSelectedScan(updatedScan.data);
        }
      } catch (err) {
        console.error('Failed to poll scans:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scans, selectedScan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setSubmitting(true);
    try {
      const config: any = {
        url,
        tools: selectedTools,
        wafBypass,
        threads: parseInt(threads) || 10,
        timeout: parseInt(timeout) || 30,
      };

      if (blindXss.trim()) config.blindXss = blindXss;
      if (cookies.trim()) config.cookies = cookies;
      if (customPayloads.trim()) {
        config.customPayloads = customPayloads.split('\n').filter(Boolean);
      }

      const response = await xssApi.start(config);
      setScans(prev => [response.data, ...prev]);
      setSelectedScan(response.data);
      setShowForm(false);
      
      // Reset form
      setUrl('');
      setBlindXss('');
      setCookies('');
      setCustomPayloads('');
    } catch (err) {
      console.error('Failed to start XSS scan:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (scanId: string) => {
    try {
      await xssApi.cancel(scanId);
      const scansRes = await xssApi.getScans();
      setScans(scansRes.data || []);
      if (selectedScan?._id === scanId) {
        const updatedScan = await xssApi.getScan(scanId);
        setSelectedScan(updatedScan.data);
      }
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  };

  const handleViewScan = async (scan: XssScan) => {
    try {
      const response = await xssApi.getScan(scan._id);
      setSelectedScan(response.data);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to fetch scan:', err);
    }
  };

  const copyPayload = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(payload);
    setTimeout(() => setCopiedPayload(null), 2000);
  };

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => 
      prev.includes(toolName) 
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const filteredResults = selectedScan?.results?.filter(r => {
    if (!resultFilter) return true;
    return r.url.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.parameter.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.payload.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.type.toLowerCase().includes(resultFilter.toLowerCase());
  }) || [];

  const stats = {
    total: scans.length,
    running: scans.filter(s => s.status === 'running').length,
    completed: scans.filter(s => s.status === 'completed').length,
    vulns: scans.reduce((acc, s) => acc + (s.vulnerabilitiesFound || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-400" />
            XSS Scanner
          </h1>
          <p className="text-slate-400 mt-1">Cross-Site Scripting vulnerability detection with best-in-class tools</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/xss-narutow-live-4"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            XSS Notes
          </Link>
          <button
            onClick={() => { setShowForm(true); setSelectedScan(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Scan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: stats.total, icon: Target, color: 'text-primary-400' },
          { label: 'Running', value: stats.running, icon: Loader2, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Vulnerabilities', value: stats.vulns, icon: AlertTriangle, color: 'text-red-400' },
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
              <stat.icon className={cn('w-8 h-8', stat.color, stat.label === 'Running' && stats.running > 0 && 'animate-spin')} />
            </div>
          </motion.div>
        ))}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Form or Scan Details */}
        <div className="lg:col-span-2">
          {showForm ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              <h2 className="text-lg font-semibold text-white mb-4">New XSS Scan</h2>
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
                      placeholder="https://example.com/search?q=test"
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">URL with parameters to test for XSS</p>
                </div>

                {/* Tools Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Scanning Tools
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => toggleTool(tool.name)}
                        disabled={!tool.installed && tool.name !== 'builtin'}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          selectedTools.includes(tool.name)
                            ? 'bg-red-500/20 border-red-500/50 text-white'
                            : 'bg-dark-800/50 border-dark-700 text-slate-400 hover:border-dark-600',
                          !tool.installed && tool.name !== 'builtin' && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm capitalize">{tool.name}</span>
                          {tool.installed ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{tool.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* WAF Bypass Toggle */}
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                  <div>
                    <p className="text-sm font-medium text-white">WAF Bypass Mode</p>
                    <p className="text-xs text-slate-500">Use advanced payloads to bypass WAF</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWafBypass(!wafBypass)}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      wafBypass ? 'bg-red-500' : 'bg-dark-600'
                    )}
                    role="switch"
                    aria-checked={wafBypass}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        wafBypass ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-dark-700 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Advanced Options
                    {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Threads</label>
                          <input
                            type="number"
                            value={threads}
                            onChange={(e) => setThreads(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Timeout (seconds)</label>
                          <input
                            type="number"
                            value={timeout}
                            onChange={(e) => setTimeout(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Blind XSS Callback URL</label>
                        <input
                          type="text"
                          value={blindXss}
                          onChange={(e) => setBlindXss(e.target.value)}
                          placeholder="https://your-callback.xss.ht"
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Cookies</label>
                        <input
                          type="text"
                          value={cookies}
                          onChange={(e) => setCookies(e.target.value)}
                          placeholder="session=abc123; token=xyz"
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Custom Payloads (one per line)</label>
                        <textarea
                          value={customPayloads}
                          onChange={(e) => setCustomPayloads(e.target.value)}
                          placeholder="<script>alert(1)</script>&#10;<img src=x onerror=alert(1)>"
                          rows={4}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 font-mono"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !url || selectedTools.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting Scan...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start XSS Scan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : selectedScan ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              {/* Scan Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white break-all">{selectedScan.url}</h2>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-sm text-slate-400">
                      Tools: {selectedScan.config.tools.join(', ')}
                    </span>
                    {selectedScan.config.wafBypass && (
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                        WAF Bypass
                      </span>
                    )}
                    {(() => {
                      const status = statusConfig[selectedScan.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', selectedScan.status === 'running' && 'animate-spin')} />
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedScan.status === 'running' && (
                    <button
                      onClick={() => handleCancel(selectedScan._id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      title="Cancel"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setShowForm(true); setSelectedScan(null); }}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    title="New Scan"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scan Info */}
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-dark-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Started</p>
                  <p className="text-sm text-white">{selectedScan.startedAt ? formatDateTime(selectedScan.startedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Completed</p>
                  <p className="text-sm text-white">{selectedScan.completedAt ? formatDateTime(selectedScan.completedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Progress</p>
                  <p className="text-sm text-white font-medium">
                    {selectedScan.totalUrls > 0 
                      ? `${selectedScan.urlsScanned}/${selectedScan.totalUrls}` 
                      : selectedScan.urlsScanned || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Vulnerabilities</p>
                  <p className="text-sm text-red-400 font-medium">{selectedScan.vulnerabilitiesFound || 0}</p>
                </div>
              </div>

              {/* Results Filter */}
              {selectedScan.results && selectedScan.results.length > 0 && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={resultFilter}
                      onChange={(e) => setResultFilter(e.target.value)}
                      placeholder="Filter results..."
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {selectedScan.status === 'running' && (!selectedScan.results || selectedScan.results.length === 0) ? (
                <div className="space-y-4">
                  {/* Progress indicator */}
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-4" />
                    <p className="text-slate-400">{selectedScan.currentPhase || 'Scanning for XSS vulnerabilities...'}</p>
                    {selectedScan.totalUrls > 0 && (
                      <div className="mt-3 w-full max-w-xs">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{selectedScan.urlsScanned} / {selectedScan.totalUrls} requests</span>
                          <span>{Math.round((selectedScan.urlsScanned / selectedScan.totalUrls) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 transition-all duration-300"
                            style={{ width: `${(selectedScan.urlsScanned / selectedScan.totalUrls) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Live logs */}
                  {selectedScan.logs && selectedScan.logs.length > 0 && (
                    <div className="border-t border-dark-700 pt-4">
                      <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4 text-slate-400" />
                        Scan Logs
                      </h3>
                      <div className="bg-dark-900 rounded-lg p-3 max-h-[300px] overflow-y-auto font-mono text-xs space-y-1">
                        {selectedScan.logs.map((log, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-slate-600 shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={cn(
                              'shrink-0 uppercase w-12',
                              log.level === 'success' && 'text-green-400',
                              log.level === 'info' && 'text-blue-400',
                              log.level === 'warn' && 'text-yellow-400',
                              log.level === 'error' && 'text-red-400',
                            )}>
                              [{log.level}]
                            </span>
                            <span className="text-slate-300">{log.message}</span>
                            {log.details && (
                              <span className="text-slate-500 truncate">{log.details}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : filteredResults.length > 0 ? (
                <div className="space-y-3">
                  {filteredResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 bg-dark-800/50 rounded-lg border border-dark-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium uppercase',
                              severityConfig[result.severity]?.bg,
                              severityConfig[result.severity]?.color
                            )}>
                              {result.severity}
                            </span>
                            <span className="px-2 py-0.5 bg-dark-700 text-slate-300 rounded text-xs">
                              {result.type}
                            </span>
                            <span className={cn('text-xs', contextConfig[result.context]?.color)}>
                              {contextConfig[result.context]?.label}
                            </span>
                            {result.wafBypassed && (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                                WAF Bypassed
                              </span>
                            )}
                            <span className="text-xs text-slate-500">via {result.tool}</span>
                          </div>
                          <p className="text-sm text-slate-300 mb-1">
                            Parameter: <span className="text-white font-mono">{result.parameter}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs text-red-400 bg-dark-900 p-2 rounded font-mono break-all">
                              {result.payload}
                            </code>
                            <button
                              onClick={() => copyPayload(result.payload)}
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Copy payload"
                            >
                              {copiedPayload === result.payload ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {result.evidence && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-500 mb-1">Evidence:</p>
                              <code className="block text-xs text-slate-400 bg-dark-900 p-2 rounded font-mono break-all">
                                {result.evidence}
                              </code>
                            </div>
                          )}
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title="Open URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No XSS vulnerabilities found</p>
                </div>
              )}

              {/* Error Display */}
              {selectedScan.error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{selectedScan.error}</p>
                </div>
              )}

              {/* Logs for completed scans */}
              {selectedScan.status !== 'running' && selectedScan.logs && selectedScan.logs.length > 0 && (
                <div className="mt-4 border-t border-dark-700 pt-4">
                  <details className="group">
                    <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-white flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      View Scan Logs ({selectedScan.logs.length} entries)
                      <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-2 bg-dark-900 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-xs space-y-1">
                      {selectedScan.logs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-slate-600 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={cn(
                            'shrink-0 uppercase w-12',
                            log.level === 'success' && 'text-green-400',
                            log.level === 'info' && 'text-blue-400',
                            log.level === 'warn' && 'text-yellow-400',
                            log.level === 'error' && 'text-red-400',
                          )}>
                            [{log.level}]
                          </span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </motion.div>
          ) : null}
        </div>


        {/* Right Panel - Scan History & Payloads */}
        <div className="lg:col-span-1 space-y-4">
          {/* Recent Scans */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <h3 className="text-sm font-medium text-white mb-3">Recent Scans</h3>
            {!mounted || loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No scans yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {scans.slice(0, 10).map((scan) => {
                  const status = statusConfig[scan.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const isSelected = selectedScan?._id === scan._id;

                  return (
                    <button
                      key={scan._id}
                      onClick={() => handleViewScan(scan)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        isSelected
                          ? 'bg-red-500/20 border-red-500/30'
                          : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{scan.url}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {scan.config.tools.join(', ')}
                          </p>
                        </div>
                        <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-xs shrink-0', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', scan.status === 'running' && 'animate-spin')} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(scan.createdAt)}
                        </span>
                        <span className={cn(
                          'text-xs',
                          scan.vulnerabilitiesFound > 0 ? 'text-red-400' : 'text-slate-400'
                        )}>
                          {scan.vulnerabilitiesFound || 0} vulns
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payload Reference */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <button
              onClick={() => setShowPayloads(!showPayloads)}
              className="w-full flex items-center justify-between text-sm font-medium text-white"
            >
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-red-400" />
                XSS Payloads Reference
              </span>
              {showPayloads ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            {showPayloads && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 space-y-2 max-h-[400px] overflow-y-auto"
              >
                {payloads.map((payload, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-dark-800/50 rounded-lg group"
                  >
                    <code className="flex-1 text-xs text-slate-300 font-mono break-all">
                      {payload}
                    </code>
                    <button
                      onClick={() => copyPayload(payload)}
                      className="p-1 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      {copiedPayload === payload ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-red-500/30">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-400" />
              Quick Tips
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Enable WAF Bypass for protected targets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Use Blind XSS for stored XSS detection
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Check different contexts: HTML, JS, URL
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Install dalfox for advanced scanning
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Test with authenticated sessions using cookies
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
