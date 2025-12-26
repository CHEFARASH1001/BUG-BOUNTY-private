'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Target,
  Shield,
  Eye,
  Flag,
  Bug,
  Clock,
  Wrench,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';

// Workflow type based on backend interfaces
type WorkflowType = 'bugbounty' | 'ctf' | 'reconnaissance' | 'vulnerability-hunting' | 'osint';

// AI Workflow interface
interface AIWorkflow {
  type: WorkflowType;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTime: number;
  requiredTools: string[];
}

// Workflow step interface
interface WorkflowStep {
  tool: string;
  parameters: Record<string, any>;
  expectedOutcome: string;
  successProbability: number;
  executionTimeEstimate: number;
  dependencies: string[];
}

// Workflow type configuration for display
const workflowConfig: Record<WorkflowType, { 
  label: string; 
  icon: typeof Zap; 
  color: string; 
  bg: string;
  description: string;
}> = {
  reconnaissance: { 
    label: 'Reconnaissance', 
    icon: Search, 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20',
    description: 'Comprehensive target discovery and enumeration'
  },
  'vulnerability-hunting': { 
    label: 'Vulnerability Hunting', 
    icon: Bug, 
    color: 'text-red-400', 
    bg: 'bg-red-500/20',
    description: 'Automated vulnerability scanning and detection'
  },
  bugbounty: { 
    label: 'Bug Bounty', 
    icon: Shield, 
    color: 'text-green-400', 
    bg: 'bg-green-500/20',
    description: 'Full bug bounty assessment workflow'
  },
  osint: { 
    label: 'OSINT', 
    icon: Eye, 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/20',
    description: 'Open source intelligence gathering'
  },
  ctf: { 
    label: 'CTF', 
    icon: Flag, 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/20',
    description: 'Capture the flag challenge workflows'
  },
};

export default function HexStrikeWorkflowsPage() {
  const [workflows, setWorkflows] = useState<AIWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');

  const fetchWorkflows = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Check server health first
      const healthRes = await hexstrikeApi.getHealth().catch(() => ({ data: { status: 'unhealthy' } }));
      setServerStatus(healthRes.data.status === 'healthy' ? 'online' : 'offline');

      // Fetch workflows
      const response = await hexstrikeApi.getWorkflows();
      setWorkflows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      setWorkflows([]);
      setServerStatus('offline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Filter workflows based on search
  const filteredWorkflows = workflows.filter((workflow) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      workflow.name.toLowerCase().includes(query) ||
      workflow.description.toLowerCase().includes(query) ||
      workflow.type.toLowerCase().includes(query)
    );
  });

  // Format estimated time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
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
              <Zap className="w-7 h-7 text-primary-400" />
              AI Workflows
            </h1>
            <p className="text-slate-400 mt-1">Automated security assessment workflows powered by AI</p>
          </div>
        </div>
        <button
          onClick={() => fetchWorkflows(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Server Status Banner */}
      {serverStatus !== 'unknown' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-3 rounded-lg border flex items-center gap-3',
            serverStatus === 'online'
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          {serverStatus === 'online' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">HexStrike AI server is online and ready</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">HexStrike AI server is offline. Workflows cannot be executed.</span>
            </>
          )}
        </motion.div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-white">{workflows.length}</div>
          <div className="text-sm text-slate-400">Available Workflows</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-blue-400">{Object.keys(workflowConfig).length}</div>
          <div className="text-sm text-slate-400">Workflow Types</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-green-400">12+</div>
          <div className="text-sm text-slate-400">AI Agents</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-purple-400">{filteredWorkflows.length}</div>
          <div className="text-sm text-slate-400">Filtered Results</div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows by name or description..."
            className="w-full pl-11 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredWorkflows.length === 0 && (
        <div className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center">
          <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Workflows Found</h3>
          <p className="text-slate-400 text-sm">
            {searchQuery
              ? 'Try adjusting your search to see more workflows.'
              : 'No AI workflows are available at the moment.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Workflows Grid */}
      {!loading && filteredWorkflows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows.map((workflow, index) => {
            const config = workflowConfig[workflow.type] || workflowConfig.reconnaissance;
            const IconComponent = config.icon;

            return (
              <motion.div
                key={workflow.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={`/dashboard/hexstrike/workflows/${workflow.type}`}
                  className={cn(
                    'block p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-primary-500/30 transition-all group',
                    serverStatus === 'offline' && 'opacity-60 pointer-events-none'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn('p-3 rounded-lg', config.bg)}>
                      <IconComponent className={cn('w-6 h-6', config.color)} />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary-400 transition-colors" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors mb-2">
                    {workflow.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    {workflow.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{formatTime(workflow.estimatedTime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{workflow.requiredTools.length} tools</span>
                    </div>
                  </div>

                  {/* Required Tools Preview */}
                  {workflow.requiredTools.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dark-700">
                      <div className="text-xs text-slate-500 mb-2">Required Tools:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {workflow.requiredTools.slice(0, 4).map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-0.5 bg-dark-800 rounded text-xs text-slate-400"
                          >
                            {tool}
                          </span>
                        ))}
                        {workflow.requiredTools.length > 4 && (
                          <span className="px-2 py-0.5 bg-dark-800 rounded text-xs text-slate-500">
                            +{workflow.requiredTools.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI Agents Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-400" />
          About AI Workflows
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
          <div>
            <h4 className="font-medium text-white mb-2">Intelligent Automation</h4>
            <p>
              AI workflows combine multiple security tools into intelligent attack chains. 
              The AI decision engine optimizes tool selection and execution order based on 
              target characteristics and discovered information.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Comprehensive Coverage</h4>
            <p>
              Each workflow is designed to provide thorough coverage of specific security 
              assessment areas. From reconnaissance to vulnerability hunting, workflows 
              ensure no critical checks are missed.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
