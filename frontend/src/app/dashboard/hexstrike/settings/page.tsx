'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  ArrowLeft,
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Server,
  Cpu,
  Clock,
  Gauge,
  Layers,
  FolderOpen,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';

interface HexStrikeConfig {
  threads: number;
  timeout: number;
  rateLimit: number;
  scanDepth: number;
  outputDir: string;
  version?: string;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  version?: string;
  uptime?: number;
  toolsAvailable?: number;
  message?: string;
}

export default function HexStrikeSettingsPage() {
  const [config, setConfig] = useState<HexStrikeConfig>({
    threads: 10,
    timeout: 300,
    rateLimit: 10,
    scanDepth: 3,
    outputDir: '/app/results',
  });
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch health status
      const healthRes = await hexstrikeApi.getHealth().catch(() => ({
        data: { status: 'unhealthy', message: 'Unable to connect to HexStrike AI server' }
      }));
      setHealth(healthRes.data);

      // Fetch configuration
      const configRes = await hexstrikeApi.getConfig();
      setConfig(configRes.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load configuration';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await hexstrikeApi.updateConfig({
        threads: config.threads,
        timeout: config.timeout,
        rateLimit: config.rateLimit,
        scanDepth: config.scanDepth,
        outputDir: config.outputDir,
      });
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save configuration';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof HexStrikeConfig, value: number | string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const formatUptime = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400';
      case 'unhealthy':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20';
      case 'unhealthy':
        return 'bg-red-500/20';
      default:
        return 'bg-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hexstrike"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Settings className="w-7 h-7 text-primary-400" />
              HexStrike AI Settings
            </h1>
            <p className="text-slate-400 mt-1">Configure scan parameters and server settings</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Server Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'p-5 rounded-xl border',
          health.status === 'healthy'
            ? 'bg-green-500/10 border-green-500/30'
            : health.status === 'unhealthy'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-slate-500/10 border-slate-500/30'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-lg', getStatusBg(health.status))}>
              <Server className={cn('w-6 h-6', getStatusColor(health.status))} />
            </div>
            <div>
              <h3 className={cn('font-semibold', getStatusColor(health.status))}>
                {health.status === 'healthy'
                  ? 'Server Online'
                  : health.status === 'unhealthy'
                  ? 'Server Offline'
                  : 'Checking Status...'}
              </h3>
              <p className="text-sm text-slate-400">
                {health.message || (health.version ? `Version ${health.version}` : 'Connecting...')}
              </p>
            </div>
          </div>
          {health.status === 'healthy' && (
            <div className="flex items-center gap-8 text-sm">
              {health.version && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{health.version}</p>
                  <p className="text-slate-400">Version</p>
                </div>
              )}
              {health.toolsAvailable !== undefined && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{health.toolsAvailable}</p>
                  <p className="text-slate-400">Tools</p>
                </div>
              )}
              {health.uptime !== undefined && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{formatUptime(health.uptime)}</p>
                  <p className="text-slate-400">Uptime</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center"
        >
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading configuration...</p>
        </motion.div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Success State */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400 text-sm">{success}</p>
        </motion.div>
      )}

      {/* Configuration Form */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary-400" />
            Scan Configuration
          </h3>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Threads */}
              <div>
                <label htmlFor="threads" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Cpu className="w-4 h-4 text-slate-500" />
                  Threads
                </label>
                <input
                  id="threads"
                  type="number"
                  min={1}
                  max={100}
                  value={config.threads}
                  onChange={(e) => handleInputChange('threads', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Number of concurrent threads (1-100)
                </p>
              </div>

              {/* Timeout */}
              <div>
                <label htmlFor="timeout" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Timeout (seconds)
                </label>
                <input
                  id="timeout"
                  type="number"
                  min={30}
                  max={3600}
                  value={config.timeout}
                  onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 30)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Maximum execution time per tool (30-3600 seconds)
                </p>
              </div>

              {/* Rate Limit */}
              <div>
                <label htmlFor="rateLimit" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Gauge className="w-4 h-4 text-slate-500" />
                  Rate Limit (req/sec)
                </label>
                <input
                  id="rateLimit"
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rateLimit}
                  onChange={(e) => handleInputChange('rateLimit', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Maximum requests per second (1-1000)
                </p>
              </div>

              {/* Scan Depth */}
              <div>
                <label htmlFor="scanDepth" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  Scan Depth
                </label>
                <input
                  id="scanDepth"
                  type="number"
                  min={1}
                  max={5}
                  value={config.scanDepth}
                  onChange={(e) => handleInputChange('scanDepth', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Recursion depth for scanning (1-5)
                </p>
              </div>
            </div>

            {/* Output Directory */}
            <div>
              <label htmlFor="outputDir" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <FolderOpen className="w-4 h-4 text-slate-500" />
                Output Directory
              </label>
              <input
                id="outputDir"
                type="text"
                value={config.outputDir}
                onChange={(e) => handleInputChange('outputDir', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Directory path for storing scan results
              </p>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-blue-400 mb-1">Configuration Notes</p>
                <ul className="list-disc list-inside text-slate-400 space-y-1">
                  <li>Changes are applied immediately without requiring a server restart</li>
                  <li>Higher thread counts may increase resource usage</li>
                  <li>Rate limiting helps prevent target overload and detection</li>
                </ul>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
                  saving
                    ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-500 text-white'
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}
