'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';
import { TargetProfileDisplay, TargetProfile } from '@/components/hexstrike';

export default function HexStrikeAnalyzePage() {
  const [target, setTarget] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'passive' | 'active' | 'aggressive'>('passive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TargetProfile | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!target.trim()) {
      setError('Please enter a target to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const response = await hexstrikeApi.analyzeTarget({
        target: target.trim(),
        mode: analysisMode,
      });
      setProfile(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to analyze target';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleAnalyze({ preventDefault: () => {} } as React.FormEvent);
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
              <Target className="w-7 h-7 text-primary-400" />
              Target Analysis
            </h1>
            <p className="text-slate-400 mt-1">AI-powered target profiling and attack surface analysis</p>
          </div>
        </div>
      </div>

      {/* Analysis Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
      >
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <label htmlFor="target" className="block text-sm font-medium text-slate-300 mb-2">
              Target
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter domain, IP address, or URL (e.g., example.com, 192.168.1.1)"
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
                disabled={loading}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Supports domains, IP addresses, and URLs. The AI will automatically detect the target type.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Analysis Mode
            </label>
            <div className="flex gap-3">
              {(['passive', 'active', 'aggressive'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAnalysisMode(mode)}
                  disabled={loading}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all capitalize',
                    analysisMode === mode
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                      : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600 hover:text-white'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {analysisMode === 'passive' && 'Non-intrusive analysis using public data sources only'}
              {analysisMode === 'active' && 'Moderate probing with port scanning and service detection'}
              {analysisMode === 'aggressive' && 'Full reconnaissance including vulnerability scanning'}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !target.trim()}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
                loading || !target.trim()
                  ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-500 text-white'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Analyze Target
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center"
        >
          <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Analyzing Target</h3>
          <p className="text-slate-400 text-sm">
            The AI is gathering intelligence and profiling the target...
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {['Scanning ports', 'Detecting services', 'Identifying technologies', 'Calculating risk'].map((step, i) => (
              <span
                key={step}
                className={cn(
                  'px-3 py-1 rounded-full text-xs',
                  i === 0 ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-800 text-slate-500'
                )}
              >
                {step}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-1">Analysis Failed</h3>
              <p className="text-slate-300 text-sm mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Analysis
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Target Profile Display */}
      {profile && !loading && !error && (
        <TargetProfileDisplay profile={profile} />
      )}
    </div>
  );
}
