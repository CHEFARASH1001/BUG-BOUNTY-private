'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Server,
  Target,
  Activity,
  Clock,
  ArrowUpRight,
  Play,
  Pause,
  Loader2,
  RefreshCw,
  Zap,
  Shield,
  Bug,
  Search,
  ChevronRight,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Radar,
  Crosshair,
  Scan,
  Radio,
  DollarSign,
  TrendingUp,
  Flame,
  Award,
  Skull,
  AlertTriangle,
  Eye,
  Lock,
  Unlock,
  FileWarning,
  Database,
  Code,
  ExternalLink,
  Sparkles,
  Trophy,
  Siren,
  CircleDot,
  Layers,
  StickyNote,
  Plus,
  Trash2,
  Copy,
  Check,
  Tag,
  Link as LinkIcon,
  FileText,
  X,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
} from 'lucide-react';
import Link from 'next/link';
import { programsApi, domainsApi, subdomainsApi, cronApi, toolsApi } from '@/lib/api';

// Simulated live threat feed data
const threatFeedData = [
  { id: 1, type: 'critical', vuln: 'RCE via SSTI', target: 'api.*.com', bounty: '$15,000', time: '2m ago' },
  { id: 2, type: 'high', vuln: 'SQL Injection', target: 'login.*.io', bounty: '$5,000', time: '15m ago' },
  { id: 3, type: 'high', vuln: 'IDOR in API', target: 'app.*.com', bounty: '$3,500', time: '1h ago' },
  { id: 4, type: 'medium', vuln: 'Stored XSS', target: 'dashboard.*.net', bounty: '$2,000', time: '2h ago' },
  { id: 5, type: 'critical', vuln: 'Auth Bypass', target: 'admin.*.com', bounty: '$10,000', time: '3h ago' },
  { id: 6, type: 'high', vuln: 'SSRF to AWS', target: 'upload.*.io', bounty: '$7,500', time: '5h ago' },
];

// Vulnerability types for the radar
const vulnTypes = [
  { name: 'XSS', count: 0, color: '#ff6b6b' },
  { name: 'SQLi', count: 0, color: '#4ecdc4' },
  { name: 'IDOR', count: 0, color: '#45b7d1' },
  { name: 'SSRF', count: 0, color: '#96ceb4' },
  { name: 'RCE', count: 0, color: '#ff8c42' },
  { name: 'Auth', count: 0, color: '#a855f7' },
];

// Tips for bug hunters
const hunterTips = [
  "💡 Check for IDOR by incrementing IDs in API responses",
  "🔍 Always test password reset flows for token leakage",
  "⚡ Use waybackurls to find forgotten endpoints",
  "🎯 GraphQL introspection often reveals hidden queries",
  "🔐 Test JWT tokens with 'none' algorithm",
  "🌐 Check for CORS misconfigurations on API endpoints",
  "📝 Look for sensitive data in JavaScript source maps",
  "🚀 Race conditions in payment flows = high bounties",
];

interface DashboardStats {
  programs: number;
  domains: number;
  subdomains: number;
  aliveSubdomains: number;
}

interface CronExecution {
  _id: string;
  jobName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

interface Tool {
  _id: string;
  name: string;
  displayName: string;
  installation?: { isInstalled?: boolean };
}

// Note types for the scratchpad
type NoteType = 'finding' | 'url' | 'payload' | 'idea' | 'todo';

interface Note {
  id: string;
  content: string;
  type: NoteType;
  timestamp: Date;
  pinned: boolean;
  tags: string[];
}

const noteTypeConfig: Record<NoteType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  finding: { icon: Bug, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Finding' },
  url: { icon: LinkIcon, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'URL' },
  payload: { icon: Code, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Payload' },
  idea: { icon: Sparkles, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Idea' },
  todo: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', label: 'To-Do' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ programs: 0, domains: 0, subdomains: 0, aliveSubdomains: 0 });
  const [recentExecutions, setRecentExecutions] = useState<CronExecution[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTip, setCurrentTip] = useState(0);
  const [threatIndex, setThreatIndex] = useState(0);
  const [isHunting, setIsHunting] = useState(false);
  const [huntProgress, setHuntProgress] = useState(0);
  const [totalBounty, setTotalBounty] = useState(0);
  const [streak, setStreak] = useState(7);
  const [xp, setXp] = useState(2450);

  // Notes Scratchpad state
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<NoteType>('finding');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [noteFilter, setNoteFilter] = useState<NoteType | 'all'>('all');

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('bb-scratchpad-notes');
    if (savedNotes) {
      const parsed = JSON.parse(savedNotes);
      setNotes(parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
    }
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('bb-scratchpad-notes', JSON.stringify(notes));
    }
  }, [notes]);

  const addNote = () => {
    if (!newNoteContent.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      content: newNoteContent.trim(),
      type: newNoteType,
      timestamp: new Date(),
      pinned: false,
      tags: [],
    };

    setNotes((prev) => [newNote, ...prev]);
    setNewNoteContent('');
    setXp((x) => x + 5); // Earn XP for taking notes
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePinNote = (id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const copyNote = (note: Note) => {
    navigator.clipboard.writeText(note.content);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const exportNotes = () => {
    const content = notes
      .map((n) => `[${noteTypeConfig[n.type].label}] ${n.content}\n${n.timestamp.toLocaleString()}`)
      .join('\n\n---\n\n');

    const blob = new Blob([`# Bug Bounty Notes\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n${content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bb-notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredNotes = notes
    .filter((n) => noteFilter === 'all' || n.type === noteFilter)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  // Rotate tips
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % hunterTips.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Rotate threat feed
  useEffect(() => {
    const timer = setInterval(() => {
      setThreatIndex((prev) => (prev + 1) % threatFeedData.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate hunt progress
  useEffect(() => {
    if (isHunting) {
      const timer = setInterval(() => {
        setHuntProgress((prev) => {
          if (prev >= 100) {
            setIsHunting(false);
            setTotalBounty((b) => b + Math.floor(Math.random() * 500) + 100);
            setXp((x) => x + Math.floor(Math.random() * 50) + 10);
            return 0;
          }
          return prev + Math.random() * 3;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [isHunting]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [programsRes, domainsRes, subdomainsRes, aliveSubdomainsRes, executionsRes, toolsRes] = await Promise.all([
        programsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        domainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        subdomainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        subdomainsApi.getAll({ limit: 1, isAlive: true }).catch(() => ({ data: { pagination: { total: 0 } } })),
        cronApi.getExecutions({ limit: 5 }).catch(() => ({ data: [] })),
        toolsApi.getAll().catch(() => ({ data: [] })),
      ]);

      setStats({
        programs: programsRes.data?.pagination?.total ?? 0,
        domains: domainsRes.data?.pagination?.total ?? 0,
        subdomains: subdomainsRes.data?.pagination?.total ?? 0,
        aliveSubdomains: aliveSubdomainsRes.data?.pagination?.total ?? 0,
      });
      setRecentExecutions(Array.isArray(executionsRes.data) ? executionsRes.data : []);
      setTools(Array.isArray(toolsRes.data) ? toolsRes.data : []);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const installedTools = tools.filter(t => t.installation?.isInstalled).length;
  const totalTools = tools.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-[#30d158]" />;
      case 'running': return <Loader2 className="w-4 h-4 text-[#0a84ff] animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4 text-[#ff453a]" />;
      default: return <AlertCircle className="w-4 h-4 text-[#8e8e93]" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const AnimatedNumber = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
      let start = 0;
      const increment = value / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }, [value, duration]);
    return <span>{displayValue.toLocaleString()}</span>;
  };

  const currentThreat = threatFeedData[threatIndex];

  return (
    <div className="space-y-5 pb-6">
      {/* Live Threat Ticker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 rounded-xl border border-red-500/20 p-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-lg">
            <Siren className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-[12px] font-bold text-red-400 uppercase tracking-wider">Live Feed</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={threatIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-4 flex-1"
            >
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                currentThreat.type === 'critical' ? 'bg-red-500/30 text-red-300' :
                currentThreat.type === 'high' ? 'bg-orange-500/30 text-orange-300' :
                'bg-yellow-500/30 text-yellow-300'
              }`}>
                {currentThreat.type}
              </span>
              <span className="text-[14px] text-white font-medium">{currentThreat.vuln}</span>
              <span className="text-[13px] text-[#8e8e93]">on {currentThreat.target}</span>
              <span className="text-[14px] text-primary-400 font-bold ml-auto">{currentThreat.bounty}</span>
              <span className="text-[12px] text-[#636366]">{currentThreat.time}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Hero Section with Hunter Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] via-[#0d1f0d] to-[#1a1a1a] p-6"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary-500/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/30 to-primary-600/10 flex items-center justify-center backdrop-blur-sm border border-primary-500/20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                    <Radar className="w-10 h-10 text-primary-400" />
                  </motion.div>
                </div>
                <div className="absolute inset-0 rounded-2xl bg-primary-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                  <span className="text-[13px] text-primary-400 font-medium uppercase tracking-wider">Hunting Mode Active</span>
                </div>
                <h1 className="text-[28px] font-bold text-white tracking-tight">Bug Bounty HQ</h1>
                <p className="text-[14px] text-[#8e8e93]">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Hunt Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsHunting(!isHunting)}
                className={`flex-1 py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                  isHunting
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                }`}
              >
                {isHunting ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Stop Hunting
                  </>
                ) : (
                  <>
                    <Crosshair className="w-5 h-5" />
                    Start Hunt
                  </>
                )}
              </button>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="p-4 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-2xl transition-all"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Hunt Progress */}
            {isHunting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#8e8e93]">Scanning targets...</span>
                  <span className="text-[13px] text-primary-400 font-medium">{Math.floor(huntProgress)}%</span>
                </div>
                <div className="h-2 bg-[#2c2c2e] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                    style={{ width: `${huntProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Hunter Profile Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#1c1c1e] rounded-3xl p-5 border border-white/5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Skull className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-white">Hunter Profile</div>
              <div className="text-[12px] text-primary-400">Level {Math.floor(xp / 500) + 1}</div>
            </div>
            <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-lg">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-[13px] font-bold text-orange-400">{streak}</span>
            </div>
          </div>

          {/* XP Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#8e8e93] uppercase tracking-wider">Experience</span>
              <span className="text-[12px] text-white font-medium">{xp} XP</span>
            </div>
            <div className="h-2 bg-[#2c2c2e] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${(xp % 500) / 5}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#2c2c2e] rounded-xl text-center">
              <DollarSign className="w-5 h-5 text-primary-400 mx-auto mb-1" />
              <div className="text-[18px] font-bold text-white">${totalBounty}</div>
              <div className="text-[11px] text-[#636366]">Total Bounty</div>
            </div>
            <div className="p-3 bg-[#2c2c2e] rounded-xl text-center">
              <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-[18px] font-bold text-white">{stats.aliveSubdomains}</div>
              <div className="text-[11px] text-[#636366]">Targets Found</div>
            </div>
          </div>

          {/* Achievements */}
          <div className="mt-4 pt-4 border-t border-[#2c2c2e]">
            <div className="text-[11px] text-[#8e8e93] uppercase tracking-wider mb-2">Badges</div>
            <div className="flex gap-2">
              {['🎯', '🔥', '💀', '⚡', '🏆'].map((badge, i) => (
                <div key={i} className="w-8 h-8 rounded-lg bg-[#2c2c2e] flex items-center justify-center text-[16px]">
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tip of the Day */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 rounded-xl border border-purple-500/20 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTip}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-[14px] text-white/90 flex-1"
            >
              {hunterTips[currentTip]}
            </motion.p>
          </AnimatePresence>
          <div className="flex gap-1">
            {hunterTips.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentTip ? 'bg-purple-400' : 'bg-[#3c3c3e]'}`} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { name: 'Programs', value: stats.programs, icon: Target, gradient: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', href: '/dashboard/programs' },
          { name: 'Domains', value: stats.domains, icon: Globe, gradient: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400', href: '/dashboard/domains' },
          { name: 'Subdomains', value: stats.subdomains, icon: Server, gradient: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400', href: '/dashboard/subdomains' },
          { name: 'Alive Hosts', value: stats.aliveSubdomains, icon: Activity, gradient: 'from-primary-500/20 to-primary-600/5', iconColor: 'text-primary-400', href: '/dashboard/subdomains?alive=true' },
        ].map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
          >
            <Link href={stat.href}>
              <div className={`relative overflow-hidden p-4 bg-gradient-to-br ${stat.gradient} rounded-2xl border border-white/5 hover:border-white/10 transition-all group active:scale-[0.98]`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-xl bg-black/20">
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
                <div className="text-[28px] font-bold text-white tracking-tight leading-none mb-1">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AnimatedNumber value={stat.value} />}
                </div>
                <div className="text-[12px] text-[#8e8e93]">{stat.name}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vulnerability Radar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#1c1c1e] rounded-2xl p-5"
        >
          <h2 className="text-[17px] font-bold text-white flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary-400" />
            Vulnerability Radar
          </h2>

          <div className="space-y-3">
            {[
              { name: 'XSS', severity: 'high', count: 12, color: 'bg-red-500' },
              { name: 'SQL Injection', severity: 'critical', count: 3, color: 'bg-orange-500' },
              { name: 'IDOR', severity: 'high', count: 8, color: 'bg-yellow-500' },
              { name: 'SSRF', severity: 'medium', count: 5, color: 'bg-blue-500' },
              { name: 'Auth Bypass', severity: 'critical', count: 2, color: 'bg-purple-500' },
            ].map((vuln, i) => (
              <div key={vuln.name} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${vuln.color}`} />
                <span className="text-[14px] text-white flex-1">{vuln.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded uppercase font-bold ${
                  vuln.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  vuln.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>{vuln.severity}</span>
                <span className="text-[14px] font-bold text-white w-8 text-right">{vuln.count}</span>
              </div>
            ))}
          </div>

          <Link href="/dashboard/checklist" className="mt-4 flex items-center justify-center gap-2 py-3 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-xl text-[14px] text-white font-medium transition-all">
            <Bug className="w-4 h-4" />
            Open Checklist
          </Link>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1c1c1e] rounded-2xl p-5"
        >
          <h2 className="text-[17px] font-bold text-white flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary-400" />
            Quick Actions
          </h2>

          <div className="space-y-2">
            {[
              { name: 'Subdomain Scan', desc: 'Find hidden assets', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/20' },
              { name: 'HTTP Probe', desc: 'Check live hosts', icon: Wifi, color: 'text-green-400', bg: 'bg-green-500/20' },
              { name: 'Nuclei Scan', desc: 'Find vulnerabilities', icon: Crosshair, color: 'text-red-400', bg: 'bg-red-500/20' },
              { name: 'Port Scan', desc: 'Discover services', icon: Layers, color: 'text-purple-400', bg: 'bg-purple-500/20' },
            ].map((action) => (
              <Link key={action.name} href="/dashboard/cron">
                <div className="flex items-center gap-3 p-3 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-xl transition-all group active:scale-[0.98]">
                  <div className={`p-2.5 ${action.bg} rounded-xl`}>
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium text-white">{action.name}</div>
                    <div className="text-[11px] text-[#636366]">{action.desc}</div>
                  </div>
                  <Play className="w-4 h-4 text-[#636366] group-hover:text-primary-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#1c1c1e] rounded-2xl p-5"
        >
          <h2 className="text-[17px] font-bold text-white flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-primary-400" />
            System Status
          </h2>

          <div className="space-y-2">
            {[
              { name: 'Backend API', status: 'online' },
              { name: 'MongoDB', status: 'online' },
              { name: 'RabbitMQ', status: 'online' },
              { name: 'Worker', status: 'online' },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 bg-[#2c2c2e] rounded-xl">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${service.status === 'online' ? 'bg-primary-400' : 'bg-red-400'} animate-pulse`} />
                  <span className="text-[14px] text-white">{service.name}</span>
                </div>
                <span className="text-[12px] text-primary-400 capitalize">{service.status}</span>
              </div>
            ))}
          </div>

          {/* Tools Progress */}
          <div className="mt-4 pt-4 border-t border-[#2c2c2e]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#8e8e93]">Tools Ready</span>
              <span className="text-[12px] font-medium text-white">{installedTools}/{totalTools}</span>
            </div>
            <div className="h-2 bg-[#2c2c2e] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalTools > 0 ? (installedTools / totalTools) * 100 : 0}%` }}
                className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1c1c1e] rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-400" />
            Recent Activity
          </h2>
          <Link href="/dashboard/cron" className="text-[13px] text-primary-400 hover:text-primary-300 flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : recentExecutions.length === 0 ? (
          <div className="text-center py-8">
            <Terminal className="w-10 h-10 text-[#636366] mx-auto mb-3" />
            <p className="text-[14px] text-[#8e8e93] mb-3">No recent activity</p>
            <Link href="/dashboard/cron" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-xl text-[14px] text-white font-medium">
              <Play className="w-4 h-4" /> Run First Job
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentExecutions.map((exec) => (
              <div key={exec._id} className="flex items-center gap-3 p-3 bg-[#2c2c2e] rounded-xl">
                {getStatusIcon(exec.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-white truncate">
                    {exec.jobName.replace('watch_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className="text-[11px] text-[#636366]">{new Date(exec.startedAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[12px] font-medium capitalize ${
                    exec.status === 'completed' ? 'text-primary-400' :
                    exec.status === 'running' ? 'text-blue-400' : 'text-red-400'
                  }`}>{exec.status}</div>
                  <div className="text-[11px] text-[#636366]">{formatDuration(exec.duration)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Notes Scratchpad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-[#1c1c1e] rounded-2xl overflow-hidden border border-white/5 ${isNotesExpanded ? 'fixed inset-4 z-50' : ''}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#2c2c2e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-xl">
              <StickyNote className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-white">Scratchpad</h2>
              <p className="text-[11px] text-[#636366]">{notes.length} notes • Quick capture while hunting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notes.length > 0 && (
              <button
                onClick={exportNotes}
                className="p-2 text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-lg transition-colors"
                title="Export notes"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="p-2 text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-lg transition-colors"
            >
              {isNotesExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Add */}
        <div className="p-4 border-b border-[#2c2c2e]">
          <div className="flex gap-2 mb-3">
            {(Object.keys(noteTypeConfig) as NoteType[]).map((type) => {
              const config = noteTypeConfig[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setNewNoteType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                    newNoteType === type
                      ? `${config.bg} ${config.color}`
                      : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
              placeholder="Quick note... (URLs, payloads, findings)"
              className="flex-1 px-4 py-3 bg-[#2c2c2e] border-none rounded-xl text-[14px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
            <button
              onClick={addNote}
              disabled={!newNoteContent.trim()}
              className="px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 rounded-xl text-white font-medium transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        {notes.length > 0 && (
          <div className="px-4 py-2 border-b border-[#2c2c2e] flex gap-1 overflow-x-auto">
            <button
              onClick={() => setNoteFilter('all')}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                noteFilter === 'all' ? 'bg-[#3c3c3e] text-white' : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              All ({notes.length})
            </button>
            {(Object.keys(noteTypeConfig) as NoteType[]).map((type) => {
              const count = notes.filter((n) => n.type === type).length;
              if (count === 0) return null;
              const config = noteTypeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setNoteFilter(type)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                    noteFilter === type ? `${config.bg} ${config.color}` : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Notes List */}
        <div className={`overflow-y-auto ${isNotesExpanded ? 'max-h-[calc(100vh-280px)]' : 'max-h-[300px]'}`}>
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center">
              <StickyNote className="w-10 h-10 text-[#3c3c3e] mx-auto mb-3" />
              <p className="text-[14px] text-[#636366]">No notes yet</p>
              <p className="text-[12px] text-[#4a4a4a] mt-1">Start capturing findings, URLs, and ideas</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <AnimatePresence>
                {filteredNotes.map((note) => {
                  const config = noteTypeConfig[note.type];
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`group p-3 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-xl transition-all ${note.pinned ? 'ring-1 ring-yellow-500/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 ${config.bg} rounded-lg flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-white break-words whitespace-pre-wrap">{note.content}</p>
                          <p className="text-[11px] text-[#636366] mt-1">
                            {note.timestamp.toLocaleString()}
                            {note.pinned && <span className="ml-2 text-yellow-400">📌 Pinned</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyNote(note)}
                            className="p-1.5 text-[#636366] hover:text-white hover:bg-[#4c4c4e] rounded-lg transition-colors"
                            title="Copy"
                          >
                            {copiedNoteId === note.id ? <Check className="w-3.5 h-3.5 text-primary-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => togglePinNote(note.id)}
                            className={`p-1.5 hover:bg-[#4c4c4e] rounded-lg transition-colors ${note.pinned ? 'text-yellow-400' : 'text-[#636366] hover:text-white'}`}
                            title={note.pinned ? 'Unpin' : 'Pin'}
                          >
                            {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="p-1.5 text-[#636366] hover:text-red-400 hover:bg-[#4c4c4e] rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Expanded overlay background */}
      {isNotesExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsNotesExpanded(false)}
        />
      )}

      {/* Bottom Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { name: 'Tools', desc: `${installedTools} ready`, icon: Terminal, href: '/dashboard/tools', emoji: '🛠️' },
          { name: 'Checklist', desc: 'Hunt guide', icon: Bug, href: '/dashboard/checklist', emoji: '📋' },
          { name: 'Scanners', desc: 'XSS, SQLi', icon: Crosshair, href: '/dashboard/hexstrike', emoji: '🎯' },
          { name: 'Workflows', desc: 'Automate', icon: Scan, href: '/dashboard/hexstrike/workflows', emoji: '⚡' },
        ].map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <Link href={item.href}>
              <div className="p-4 bg-[#1c1c1e] hover:bg-[#2c2c2e] rounded-2xl border border-white/5 transition-all group active:scale-[0.98]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[20px]">{item.emoji}</span>
                  <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-white transition-all" />
                </div>
                <div className="text-[15px] font-semibold text-white">{item.name}</div>
                <div className="text-[12px] text-[#636366]">{item.desc}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 py-3 text-[12px] text-[#636366]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
          <span>All systems operational</span>
        </div>
        <span>•</span>
        <span>{stats.programs} programs</span>
        <span>•</span>
        <span>{stats.subdomains} assets</span>
      </div>
    </div>
  );
}
