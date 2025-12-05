'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Globe,
  DollarSign,
  Calendar,
  ExternalLink,
  Shield,
  Layers,
  Server,
  AlertTriangle,
  Plus,
  Settings,
  Play,
  MoreHorizontal,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

// Mock program data
const programData = {
  id: '1',
  name: 'Example Corp Bug Bounty',
  platform: 'HackerOne',
  type: 'public',
  status: 'active',
  programUrl: 'https://hackerone.com/example',
  description: 'Find and report security vulnerabilities in Example Corp\'s web applications and infrastructure.',
  bountyRange: '$100 - $10,000',
  startDate: '2023-06-15',
  stats: {
    domains: 5,
    subdomains: 456,
    vulnerabilities: 23,
    reportedVulns: 18,
    pendingVulns: 5,
  },
  scope: [
    '*.example.com',
    'api.example.com',
    'app.example.com',
    'secure.example.com',
    'm.example.com',
  ],
  outOfScope: [
    'blog.example.com',
    'status.example.com',
    'support.example.com',
  ],
  domains: [
    { id: '1', domain: 'example.com', subdomains: 156, vulns: 12, status: 'active', lastScan: '2024-01-15T10:30:00Z' },
    { id: '2', domain: 'api.example.com', subdomains: 89, vulns: 5, status: 'active', lastScan: '2024-01-15T09:00:00Z' },
    { id: '3', domain: 'app.example.com', subdomains: 123, vulns: 4, status: 'active', lastScan: '2024-01-14T15:00:00Z' },
    { id: '4', domain: 'secure.example.com', subdomains: 45, vulns: 2, status: 'paused', lastScan: '2024-01-13T12:00:00Z' },
    { id: '5', domain: 'm.example.com', subdomains: 43, vulns: 0, status: 'active', lastScan: '2024-01-12T08:00:00Z' },
  ],
  recentVulns: [
    { id: 1, title: 'SQL Injection', severity: 'critical', target: 'api.example.com', status: 'reported', date: '2024-01-15' },
    { id: 2, title: 'XSS Reflected', severity: 'high', target: 'app.example.com', status: 'new', date: '2024-01-14' },
    { id: 3, title: 'CSRF', severity: 'medium', target: 'example.com', status: 'reported', date: '2024-01-13' },
    { id: 4, title: 'Info Disclosure', severity: 'low', target: 'secure.example.com', status: 'fixed', date: '2024-01-12' },
  ],
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  reported: 'bg-purple-500/20 text-purple-400',
  fixed: 'bg-green-500/20 text-green-400',
  active: 'text-green-400',
  paused: 'text-yellow-400',
};

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const program = programData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/programs"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{program.name}</h1>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                program.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              )}>
                {program.status}
              </span>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                program.type === 'public' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
              )}>
                {program.type}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              <span>{program.platform}</span>
              <span>•</span>
              <span>Started {formatDate(program.startDate)}</span>
              <span>•</span>
              <span>{program.bountyRange}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={program.programUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Program
          </a>
          <Link
            href={`/dashboard/programs/${program.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Domains', value: program.stats.domains, icon: Globe, color: 'text-blue-400' },
          { label: 'Subdomains', value: program.stats.subdomains, icon: Layers, color: 'text-purple-400' },
          { label: 'Total Vulns', value: program.stats.vulnerabilities, icon: Shield, color: 'text-red-400' },
          { label: 'Reported', value: program.stats.reportedVulns, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Pending', value: program.stats.pendingVulns, icon: AlertTriangle, color: 'text-yellow-400' },
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
              <stat.icon className={cn('w-8 h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800">
        {['overview', 'domains', 'vulnerabilities', 'scope'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize',
              activeTab === tab
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Description</h3>
            <p className="text-slate-400">{program.description}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Recent Vulnerabilities</h3>
            <div className="space-y-3">
              {program.recentVulns.map((vuln) => (
                <div key={vuln.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={cn(
                      'w-4 h-4',
                      vuln.severity === 'critical' ? 'text-red-400' :
                      vuln.severity === 'high' ? 'text-orange-400' :
                      vuln.severity === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    )} />
                    <div>
                      <p className="text-white text-sm font-medium">{vuln.title}</p>
                      <p className="text-xs text-slate-500">{vuln.target}</p>
                    </div>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded text-xs', statusColors[vuln.status])}>
                    {vuln.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <h3 className="font-semibold text-white">Domains ({program.domains.length})</h3>
            <Link
              href="/dashboard/domains/new"
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Domain</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomains</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerabilities</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Last Scan</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {program.domains.map((domain) => (
                <tr key={domain.id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <span className="text-white font-medium">{domain.domain}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{domain.subdomains}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'font-medium',
                      domain.vulns > 0 ? 'text-red-400' : 'text-slate-400'
                    )}>
                      {domain.vulns}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-sm', statusColors[domain.status])}>
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {formatDateTime(domain.lastScan)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 text-slate-400 hover:text-green-400 transition-colors" title="Scan">
                        <Play className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Vulnerabilities Tab */}
      {activeTab === 'vulnerabilities' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerability</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Severity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Target</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {program.recentVulns.map((vuln) => (
                <tr key={vuln.id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn(
                        'w-4 h-4',
                        vuln.severity === 'critical' ? 'text-red-400' :
                        vuln.severity === 'high' ? 'text-orange-400' :
                        vuln.severity === 'medium' ? 'text-yellow-400' :
                        'text-green-400'
                      )} />
                      <span className="text-white font-medium">{vuln.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs uppercase', severityColors[vuln.severity])}>
                      {vuln.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-sm">{vuln.target}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs capitalize', statusColors[vuln.status])}>
                      {vuln.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{vuln.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Scope Tab */}
      {activeTab === 'scope' && (
        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              In Scope
            </h3>
            <div className="space-y-2">
              {program.scope.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Globe className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 font-mono text-sm">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Out of Scope
            </h3>
            <div className="space-y-2">
              {program.outOfScope.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <Globe className="w-4 h-4 text-red-400" />
                  <span className="text-slate-300 font-mono text-sm">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

