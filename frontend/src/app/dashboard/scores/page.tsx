'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { scoresApi } from '@/lib/api';

interface ScoreBreakdown {
  exploitability?: {
    cveCount: number;
    publicExploits: number;
    attackComplexity: number;
    techStackAge: number;
    authBypass: number;
    total: number;
  };
  historical?: {
    pastVulnsCritical: number;
    pastVulnsHigh: number;
    pastVulnsMedium: number;
    pastVulnsLow: number;
    vulnCategories: number;
    recurringPatterns: number;
    daysSinceLastVuln: number;
    successRate: number;
    total: number;
  };
  programQuality?: {
    bountyMin: number;
    bountyMax: number;
    bountyAverage: number;
    responseTime: number;
    resolutionRate: number;
    programAge: number;
    scopeSize: number;
    wildcards: number;
    total: number;
  };
  competition?: {
    scopeCoverage: number;
    activityLevel: number;
    scopeFreshness: number;
    uniqueAssets: number;
    total: number;
  };
  attackSurface?: {
    subdomainCount: number;
    liveHostCount: number;
    httpServiceCount: number;
    apiEndpoints: number;
    adminPanels: number;
    loginPages: number;
    fileUploads: number;
    total: number;
  };
  penetration?: {
    exposedServices: number;
    outdatedTech: number;
    knownVulns: number;
    misconfigurations: number;
    authMechanisms: number;
    sensitiveExposure: number;
    total: number;
  };
}

interface Score {
  _id: string;
  targetId: string;
  targetType: string;
  targetName: string;
  exploitabilityScore: number;
  historicalScore: number;
  programQualityScore: number;
  competitionScore: number;
  attackSurfaceScore: number;
  pentestScore: number;
  totalScore: number;
  tier: string;
  confidence: number;
  breakdown: ScoreBreakdown;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  calculatedAt: string;
}

interface Stats {
  totalPrograms: number;
  totalDomains: number;
  avgScore: number;
  tierDistribution: Record<string, number>;
}

const tierColors: Record<string, string> = {
  S: 'from-yellow-400 to-amber-500',
  A: 'from-emerald-400 to-green-500',
  B: 'from-blue-400 to-cyan-500',
  C: 'from-purple-400 to-violet-500',
  D: 'from-orange-400 to-red-400',
  F: 'from-gray-400 to-gray-600',
};

const tierTextColors: Record<string, string> = {
  S: 'text-amber-400',
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-purple-400',
  D: 'text-orange-400',
  F: 'text-gray-400',
};

const sortOptions = [
  { value: 'totalScore', label: 'Total Score' },
  { value: 'exploitabilityScore', label: 'Exploitability' },
  { value: 'historicalScore', label: 'Historical' },
  { value: 'programQualityScore', label: 'Program Quality' },
  { value: 'competitionScore', label: 'Competition' },
  { value: 'attackSurfaceScore', label: 'Attack Surface' },
  { value: 'pentestScore', label: 'Penetration' },
];

function ScoreBar({ value, label, color = 'bg-cyan-500' }: { value: number; label: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value}</span>
      </div>
      <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

function TierBadge({ tier, size = 'md' }: { tier: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-20 h-20 text-4xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br ${tierColors[tier] || tierColors.F} flex items-center justify-center font-black text-white shadow-lg`}
    >
      {tier}
    </div>
  );
}

function ScoreCard({ score, rank }: { score: Score; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all"
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="text-2xl font-bold text-gray-500 w-8 text-center">
            #{rank}
          </div>

          {/* Tier Badge */}
          <TierBadge tier={score.tier} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <Link
              href={`/dashboard/programs/${score.targetId}`}
              className="text-lg font-semibold text-white hover:text-cyan-400 transition-colors truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              {score.targetName}
            </Link>
            <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <span className="text-cyan-400">●</span>
                Total: {score.totalScore}
              </span>
              <span>Confidence: {score.confidence}%</span>
            </div>
          </div>

          {/* Score Rings */}
          <div className="hidden md:flex items-center gap-3">
            <ScoreRing value={score.exploitabilityScore} label="EXP" color="#f59e0b" />
            <ScoreRing value={score.historicalScore} label="HIS" color="#10b981" />
            <ScoreRing value={score.attackSurfaceScore} label="ATK" color="#3b82f6" />
            <ScoreRing value={score.pentestScore} label="PEN" color="#8b5cf6" />
          </div>

          {/* Expand Icon */}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-4 space-y-4">
              {/* Score Bars */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <ScoreBar value={score.exploitabilityScore} label="Exploitability" color="bg-amber-500" />
                <ScoreBar value={score.historicalScore} label="Historical" color="bg-emerald-500" />
                <ScoreBar value={score.programQualityScore} label="Program Quality" color="bg-blue-500" />
                <ScoreBar value={score.competitionScore} label="Competition" color="bg-purple-500" />
                <ScoreBar value={score.attackSurfaceScore} label="Attack Surface" color="bg-cyan-500" />
                <ScoreBar value={score.pentestScore} label="Penetration" color="bg-red-500" />
              </div>

              {/* Recommendations & Insights */}
              <div className="grid md:grid-cols-3 gap-4">
                {score.strengths?.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <h4 className="text-emerald-400 font-semibold text-sm mb-2">💪 Strengths</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      {score.strengths.slice(0, 3).map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {score.weaknesses?.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <h4 className="text-red-400 font-semibold text-sm mb-2">⚠️ Weaknesses</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      {score.weaknesses.slice(0, 3).map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {score.recommendations?.length > 0 && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                    <h4 className="text-cyan-400 font-semibold text-sm mb-2">💡 Recommendations</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      {score.recommendations.slice(0, 3).map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Link
                  href={`/dashboard/programs/${score.targetId}`}
                  className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                >
                  View Program
                </Link>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await scoresApi.calculateProgram(score.targetId);
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-gray-700/50 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                  Recalculate
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          strokeWidth="4"
          fill="none"
          stroke="#374151"
        />
        <motion.circle
          cx="24"
          cy="24"
          r={radius}
          strokeWidth="4"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold text-white">{value}</span>
        <span className="text-[8px] text-gray-400">{label}</span>
      </div>
    </div>
  );
}

export default function ScoresPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [sortBy, setSortBy] = useState('totalScore');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [scoresRes, statsRes] = await Promise.all([
        scoresApi.getTopPrograms({ limit: 50, sortBy: sortBy as any }),
        scoresApi.getStats(),
      ]);
      setScores(scoresRes.data || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    try {
      setCalculating(true);
      await scoresApi.calculateAll();
      await fetchData();
    } catch (error) {
      console.error('Failed to calculate scores:', error);
    } finally {
      setCalculating(false);
    }
  };

  const filteredScores = selectedTier
    ? scores.filter(s => s.tier === selectedTier)
    : scores;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🎯</span>
              Program Scores
            </h1>
            <p className="text-gray-400 mt-1">
              AI-powered program scoring based on exploitability, history, and attack surface
            </p>
          </div>
          <button
            onClick={handleCalculateAll}
            disabled={calculating}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {calculating ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Calculating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recalculate All
              </>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4"
            >
              <div className="text-3xl font-bold text-white">{stats.totalPrograms}</div>
              <div className="text-gray-400 text-sm">Scored Programs</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4"
            >
              <div className="text-3xl font-bold text-white">{stats.totalDomains}</div>
              <div className="text-gray-400 text-sm">Scored Domains</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4"
            >
              <div className="text-3xl font-bold text-cyan-400">{stats.avgScore}</div>
              <div className="text-gray-400 text-sm">Average Score</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4"
            >
              <div className="flex gap-2">
                {['S', 'A', 'B', 'C', 'D', 'F'].map(tier => (
                  <div key={tier} className="text-center">
                    <div className={`text-lg font-bold ${tierTextColors[tier]}`}>
                      {stats.tierDistribution[tier] || 0}
                    </div>
                    <div className="text-xs text-gray-500">{tier}</div>
                  </div>
                ))}
              </div>
              <div className="text-gray-400 text-sm mt-1">Tier Distribution</div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tier:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedTier(null)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  selectedTier === null
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {['S', 'A', 'B', 'C', 'D', 'F'].map(tier => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                    selectedTier === tier
                      ? `bg-gradient-to-br ${tierColors[tier]} text-white`
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Scores Yet</h3>
            <p className="text-gray-400 mb-4">
              Click "Recalculate All" to generate scores for your programs
            </p>
          </div>
        ) : (
          /* Score Cards */
          <div className="space-y-3">
            {filteredScores.map((score, index) => (
              <ScoreCard key={score._id} score={score} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


