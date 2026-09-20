'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Play,
  Github,
  Star,
  GitCommit,
  Clock,
  Settings,
  History,
  Terminal,
  Copy,
  Download,
  X,
  Filter,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toolsApi } from '@/lib/api';

// Tool category configuration
const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  subdomain_enumeration: { label: 'Subdomain Enum', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  http_probing: { label: 'HTTP Probing', color: 'text-green-400', bg: 'bg-green-500/20' },
  directory_fuzzing: { label: 'Dir Fuzzing', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  vulnerability_scanning: { label: 'Vuln Scanning', color: 'text-red-400', bg: 'bg-red-500/20' },
  secret_detection: { label: 'Secret Detection', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  javascript_analysis: { label: 'JS Analysis', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  port_scanning: { label: 'Port Scanning', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  waf_detection: { label: 'WAF Detection', color: 'text-pink-400', bg: 'bg-pink-500/20' },
  url_discovery: { label: 'URL Discovery', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  osint: { label: 'OSINT', color: 'text-teal-400', bg: 'bg-teal-500/20' },
  dns_tools: { label: 'DNS Tools', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  web_crawling: { label: 'Web Crawling', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  parameter_discovery: { label: 'Param Discovery', color: 'text-lime-400', bg: 'bg-lime-500/20' },
  exploitation: { label: 'Exploitation', color: 'text-rose-400', bg: 'bg-rose-500/20' },
};

// Installation status configuration
const installationStatusConfig = {
  installed: { label: 'Installed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  not_installed: { label: 'Not Installed', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: XCircle },
  update_available: { label: 'Update Available', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertCircle },
};

// Execution status configuration
const executionStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
};

interface ConfigOption {
  name: string;
  flag: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
  default?: any;
}

interface Tool {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  githubUrl: string;
  categories: string[];
  validation?: {
    isValid: boolean;
    lastChecked: string;
    stars: number;
    lastCommit: string;
    reason?: string;
  };
  installation?: {
    isInstalled: boolean;
    version?: string;
    binaryName: string;
    lastChecked: string;
  };
  configOptions?: ConfigOption[];
  userConfig?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ToolExecution {
  _id: string;
  tool: string;
  arguments: string[];
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  completedAt: string;
  duration: number;
  errorMessage?: string;
  createdAt: string;
}

export default function ToolDetailPage({ params }: { params: { id: string } }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'history'>('overview');

  // Configuration form state
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Execution history filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Execution detail modal
  const [selectedExecution, setSelectedExecution] = useState<ToolExecution | null>(null);

  // Installation state
  const [installing, setInstalling] = useState(false);
  const [installMethods, setInstallMethods] = useState<{ method: string; command: string; available: boolean }[]>([]);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; method: string; output: string; error?: string } | null>(null);

  const fetchTool = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await toolsApi.getById(params.id);
      setTool(response.data);
      // Initialize config values from userConfig
      if (response.data.userConfig) {
        setConfigValues(response.data.userConfig);
      }
    } catch (err: any) {
      console.error('Failed to fetch tool:', err);
      setError(err.response?.data?.message || 'Failed to load tool');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const filters: any = { limit: 10 };
      if (statusFilter) filters.status = statusFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const response = await toolsApi.getExecutions(params.id, filters);
      setExecutions(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error('Failed to fetch executions:', err);
    }
  };

  useEffect(() => {
    fetchTool();
    fetchExecutions();
  }, [params.id]);

  useEffect(() => {
    fetchExecutions();
  }, [statusFilter, startDate, endDate]);

  const refreshStatus = async () => {
    if (!tool) return;
    setRefreshingStatus(true);
    try {
      await toolsApi.getStatus(tool._id);
      await fetchTool();
    } catch (err: any) {
      console.error('Failed to refresh status:', err);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const revalidateTool = async () => {
    if (!tool) return;
    setRevalidating(true);
    try {
      await toolsApi.validate(tool._id);
      await fetchTool();
    } catch (err: any) {
      console.error('Failed to re-validate tool:', err);
      alert(err.response?.data?.message || 'Failed to re-validate tool');
    } finally {
      setRevalidating(false);
    }
  };

  const fetchInstallMethods = async () => {
    if (!tool) return;
    try {
      const response = await toolsApi.getInstallMethods(tool._id);
      setInstallMethods(response.data);
    } catch (err: any) {
      console.error('Failed to fetch install methods:', err);
    }
  };

  const openInstallModal = async () => {
    await fetchInstallMethods();
    setInstallResult(null);
    setShowInstallModal(true);
  };

  const installTool = async (method?: string) => {
    if (!tool) return;
    setInstalling(true);
    setInstallResult(null);
    try {
      const response = await toolsApi.install(tool._id, method);
      setInstallResult(response.data);
      if (response.data.success) {
        await fetchTool();
      }
    } catch (err: any) {
      console.error('Failed to install tool:', err);
      setInstallResult({
        success: false,
        method: method || 'auto',
        output: '',
        error: err.response?.data?.message || 'Installation failed',
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleConfigChange = (name: string, value: any) => {
    setConfigValues((prev) => ({ ...prev, [name]: value }));
  };

  const saveConfig = async () => {
    if (!tool) return;
    setSavingConfig(true);
    try {
      await toolsApi.update(tool._id, { userConfig: configValues });
      await fetchTool();
      alert('Configuration saved successfully');
    } catch (err: any) {
      console.error('Failed to save config:', err);
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const getInstallationStatus = (tool: Tool): keyof typeof installationStatusConfig => {
    if (!tool.installation) return 'not_installed';
    if (!tool.installation.isInstalled) return 'not_installed';
    return 'installed';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const downloadOutput = (execution: ToolExecution) => {
    const content = `=== STDOUT ===\n${execution.stdout || '(empty)'}\n\n=== STDERR ===\n${execution.stderr || '(empty)'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool?.name}-execution-${execution._id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading tool...</span>
        </div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-red-400 text-lg">{error || 'Tool not found'}</div>
        <Link
          href="/dashboard/tools"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
      </div>
    );
  }

  const installStatus = getInstallationStatus(tool);
  const statusConfig = installationStatusConfig[installStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/tools"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Wrench className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{tool.displayName}</h1>
                <p className="text-sm text-slate-500">@{tool.name}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={tool.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </a>
          {installStatus !== 'installed' && (
            <button
              onClick={openInstallModal}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          )}
          <Link
            href={`/dashboard/tools/${tool._id}/execute`}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              installStatus === 'installed'
                ? 'bg-primary-600 hover:bg-primary-500 text-white'
                : 'bg-dark-700 text-slate-500 cursor-not-allowed pointer-events-none'
            )}
          >
            <Play className="w-4 h-4" />
            Execute
          </Link>
        </div>
      </div>

      {/* Installation Status Banner */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        statusConfig.bg,
        installStatus === 'installed' ? 'border-green-500/30' :
        installStatus === 'update_available' ? 'border-yellow-500/30' :
        'border-slate-500/30'
      )}>
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('w-6 h-6', statusConfig.color)} />
          <div>
            <p className={cn('font-medium', statusConfig.color)}>{statusConfig.label}</p>
            {tool.installation?.version && (
              <p className="text-sm text-slate-400">Version: {tool.installation.version}</p>
            )}
            {tool.installation?.binaryName && (
              <p className="text-sm text-slate-500">Binary: {tool.installation.binaryName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {installStatus !== 'installed' && (
            <button
              onClick={openInstallModal}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Install Now
            </button>
          )}
          <button
            onClick={refreshStatus}
            disabled={refreshingStatus}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshingStatus && 'animate-spin')} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800">
        {[
          { id: 'overview', label: 'Overview', icon: Wrench },
          { id: 'config', label: 'Configuration', icon: Settings },
          { id: 'history', label: 'Execution History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>


      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Tool Information</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Description</label>
                <p className="text-slate-300 mt-1">{tool.description}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Categories</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tool.categories.map((cat) => {
                    const config = categoryConfig[cat];
                    return (
                      <span
                        key={cat}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          config?.bg || 'bg-slate-500/20',
                          config?.color || 'text-slate-400'
                        )}
                      >
                        {config?.label || cat}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">GitHub Repository</label>
                <a
                  href={tool.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 mt-1"
                >
                  <Github className="w-4 h-4" />
                  {tool.githubUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Validation & Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Repository Metrics</h3>
            {tool.validation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-slate-300">Stars</span>
                  </div>
                  <span className="text-white font-medium">{tool.validation.stars?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <GitCommit className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300">Last Commit</span>
                  </div>
                  <span className="text-white font-medium">
                    {tool.validation.lastCommit ? formatDate(tool.validation.lastCommit) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">Last Validated</span>
                  </div>
                  <span className="text-white font-medium">
                    {tool.validation.lastChecked ? formatDate(tool.validation.lastChecked) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {tool.validation.isValid ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-slate-300">Validation Status</span>
                  </div>
                  <span className={cn(
                    'font-medium',
                    tool.validation.isValid ? 'text-green-400' : 'text-red-400'
                  )}>
                    {tool.validation.isValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                {tool.validation.reason && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{tool.validation.reason}</p>
                  </div>
                )}
                {/* Re-validate Button */}
                <button
                  onClick={revalidateTool}
                  disabled={revalidating}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors mt-4"
                >
                  <RefreshCw className={cn('w-4 h-4', revalidating && 'animate-spin')} />
                  {revalidating ? 'Re-validating...' : 'Re-validate GitHub Metrics'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-500">No validation data available</p>
                {/* Re-validate Button when no data */}
                <button
                  onClick={revalidateTool}
                  disabled={revalidating}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white transition-colors"
                >
                  <RefreshCw className={cn('w-4 h-4', revalidating && 'animate-spin')} />
                  {revalidating ? 'Validating...' : 'Validate GitHub Metrics'}
                </button>
              </div>
            )}
          </motion.div>

          {/* Recent Executions Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Executions</h3>
              <button
                onClick={() => setActiveTab('history')}
                className="text-sm text-primary-400 hover:text-primary-300"
              >
                View All
              </button>
            </div>
            {executions.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No executions yet</p>
            ) : (
              <div className="space-y-2">
                {executions.slice(0, 5).map((exec) => {
                  const execStatus = executionStatusConfig[exec.status];
                  return (
                    <div
                      key={exec._id}
                      onClick={() => setSelectedExecution(exec)}
                      className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm text-white font-mono">
                            {exec.arguments.length > 0 ? exec.arguments.join(' ').slice(0, 50) : '(no arguments)'}
                            {exec.arguments.join(' ').length > 50 && '...'}
                          </p>
                          <p className="text-xs text-slate-500">{formatDate(exec.startedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{formatDuration(exec.duration)}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          execStatus?.bg || 'bg-slate-500/20',
                          execStatus?.color || 'text-slate-400'
                        )}>
                          {execStatus?.label || exec.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Configuration Options</h3>
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {savingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </div>

          {tool.configOptions && tool.configOptions.length > 0 ? (
            <div className="space-y-4">
              {tool.configOptions.map((option) => (
                <div key={option.name} className="p-4 bg-dark-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <label className="text-sm font-medium text-white">
                        {option.name}
                        {option.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                      <p className="text-xs text-slate-600 font-mono mt-1">Flag: {option.flag}</p>
                    </div>
                  </div>

                  {option.type === 'boolean' ? (
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={configValues[option.name] ?? option.default ?? false}
                        onChange={(e) => handleConfigChange(option.name, e.target.checked)}
                        className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-300">Enable</span>
                    </label>
                  ) : option.type === 'number' ? (
                    <input
                      type="number"
                      value={configValues[option.name] ?? option.default ?? ''}
                      onChange={(e) => handleConfigChange(option.name, e.target.value ? Number(e.target.value) : undefined)}
                      placeholder={option.default?.toString() || 'Enter value'}
                      className="mt-2 w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={configValues[option.name] ?? option.default ?? ''}
                      onChange={(e) => handleConfigChange(option.name, e.target.value || undefined)}
                      placeholder={option.default?.toString() || 'Enter value'}
                      className="mt-2 w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500">No configuration options available for this tool</p>
            </div>
          )}
        </motion.div>
      )}


      {/* Execution History Tab */}
      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
                className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
                className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              onClick={() => {
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Executions Table */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
            {executions.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500">No executions found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-800">
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Arguments</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Duration</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Started At</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => {
                    const execStatus = executionStatusConfig[exec.status];
                    return (
                      <tr
                        key={exec._id}
                        className="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer"
                        onClick={() => setSelectedExecution(exec)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm text-white font-mono truncate max-w-xs">
                            {exec.arguments.length > 0 ? exec.arguments.join(' ') : '(no arguments)'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            execStatus?.bg || 'bg-slate-500/20',
                            execStatus?.color || 'text-slate-400'
                          )}>
                            {execStatus?.label || exec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {formatDuration(exec.duration)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {formatDate(exec.startedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedExecution(exec);
                            }}
                            className="text-primary-400 hover:text-primary-300 text-sm"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* Execution Detail Modal */}
      {selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[90vh] bg-dark-900 rounded-xl border border-dark-700 overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <div>
                <h3 className="text-lg font-semibold text-white">Execution Details</h3>
                <p className="text-sm text-slate-500">{formatDate(selectedExecution.startedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(selectedExecution.stdout + '\n' + selectedExecution.stderr)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Copy Output"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => downloadOutput(selectedExecution)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Download Output"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedExecution(null)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Execution Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-dark-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Status</p>
                  <p className={cn(
                    'text-sm font-medium mt-1',
                    executionStatusConfig[selectedExecution.status]?.color || 'text-slate-400'
                  )}>
                    {executionStatusConfig[selectedExecution.status]?.label || selectedExecution.status}
                  </p>
                </div>
                <div className="p-3 bg-dark-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Duration</p>
                  <p className="text-sm font-medium text-white mt-1">{formatDuration(selectedExecution.duration)}</p>
                </div>
                <div className="p-3 bg-dark-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Exit Code</p>
                  <p className={cn(
                    'text-sm font-medium mt-1',
                    selectedExecution.exitCode === 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {selectedExecution.exitCode}
                  </p>
                </div>
                <div className="p-3 bg-dark-800/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Completed At</p>
                  <p className="text-sm font-medium text-white mt-1">
                    {selectedExecution.completedAt ? formatDate(selectedExecution.completedAt) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Arguments */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Arguments</h4>
                <div className="p-3 bg-dark-800 rounded-lg font-mono text-sm text-slate-300">
                  {selectedExecution.arguments.length > 0 ? selectedExecution.arguments.join(' ') : '(no arguments)'}
                </div>
              </div>

              {/* Configuration Used */}
              {selectedExecution.config && Object.keys(selectedExecution.config).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Configuration Used</h4>
                  <div className="p-3 bg-dark-800 rounded-lg">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      {JSON.stringify(selectedExecution.config, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedExecution.errorMessage && (
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-2">Error Message</h4>
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{selectedExecution.errorMessage}</p>
                  </div>
                </div>
              )}

              {/* STDOUT */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Standard Output (stdout)</h4>
                <div className="p-3 bg-dark-950 rounded-lg max-h-64 overflow-auto">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {selectedExecution.stdout || '(empty)'}
                  </pre>
                </div>
              </div>

              {/* STDERR */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Standard Error (stderr)</h4>
                <div className="p-3 bg-dark-950 rounded-lg max-h-64 overflow-auto">
                  <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">
                    {selectedExecution.stderr || '(empty)'}
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Install Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-dark-900 rounded-xl border border-dark-700 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Download className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Install {tool.displayName}</h3>
                  <p className="text-sm text-slate-500">Choose installation method</p>
                </div>
              </div>
              {!installing && (
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {installing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
                  <p className="text-white font-medium">Installing {tool.displayName}...</p>
                  <p className="text-sm text-slate-400 mt-2">This may take a few minutes</p>
                </div>
              ) : installResult ? (
                <div className="space-y-4">
                  {installResult.success ? (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-green-400 font-medium">Installation Successful!</p>
                      <p className="text-sm text-green-400/70 mt-1">
                        Installed via {installResult.method}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                      <p className="text-red-400 font-medium text-center">Installation Failed</p>
                      {installResult.error && (
                        <p className="text-sm text-red-400/70 mt-2">{installResult.error}</p>
                      )}
                    </div>
                  )}

                  {installResult.output && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Output</h4>
                      <div className="p-3 bg-dark-950 rounded-lg max-h-40 overflow-auto">
                        <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                          {installResult.output}
                        </pre>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowInstallModal(false)}
                    className="w-full py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Auto Install */}
                  <button
                    onClick={() => installTool()}
                    className="w-full flex items-center justify-between p-4 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Download className="w-5 h-5 text-white" />
                      <div className="text-left">
                        <p className="text-white font-medium">Auto Install</p>
                        <p className="text-sm text-green-100/70">Automatically detect best method</p>
                      </div>
                    </div>
                    <Play className="w-5 h-5 text-white" />
                  </button>

                  {/* Available Methods */}
                  {installMethods.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Or choose specific method:</h4>
                      <div className="space-y-2">
                        {installMethods.map((method) => (
                          <button
                            key={method.method}
                            onClick={() => installTool(method.method)}
                            disabled={!method.available}
                            className={cn(
                              'w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left',
                              method.available
                                ? 'bg-dark-800 hover:bg-dark-700'
                                : 'bg-dark-800/50 opacity-50 cursor-not-allowed'
                            )}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium capitalize">{method.method}</span>
                                {!method.available && (
                                  <span className="text-xs text-red-400">(not available)</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono mt-1 truncate max-w-[350px]">
                                {method.command}
                              </p>
                            </div>
                            {method.available && <Play className="w-4 h-4 text-slate-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {installMethods.length === 0 && (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Loading installation methods...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
