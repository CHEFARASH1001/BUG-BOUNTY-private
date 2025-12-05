'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  ArrowLeft,
  Play,
  Pause,
  Settings,
  ExternalLink,
  Layers,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  Lock,
  Eye,
  Download,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime } from '@/lib/utils';

// Mock domain data
const domainData = {
  id: '1',
  domain: 'example.com',
  program: { id: '1', name: 'Example Corp Bug Bounty' },
  status: 'active',
  lastScan: '2024-01-15T10:30:00Z',
  stats: {
    subdomains: 156,
    aliveSubdomains: 142,
    ports: 423,
    vulnerabilities: 12,
    endpoints: 89,
    technologies: 15,
  },
  recentScans: [
    { id: '1', type: 'full', status: 'completed', date: '2024-01-15T10:30:00Z', vulns: 3 },
    { id: '2', type: 'quick', status: 'completed', date: '2024-01-14T08:00:00Z', vulns: 1 },
    { id: '3', type: 'vulnerability', status: 'completed', date: '2024-01-13T15:00:00Z', vulns: 0 },
  ],
  topSubdomains: [
    { subdomain: 'api.example.com', ip: '192.168.1.100', status: 200, vulns: 5 },
    { subdomain: 'app.example.com', ip: '192.168.1.101', status: 200, vulns: 3 },
    { subdomain: 'staging.example.com', ip: '192.168.1.102', status: 401, vulns: 2 },
    { subdomain: 'dev.example.com', ip: '192.168.1.103', status: 403, vulns: 1 },
    { subdomain: 'mail.example.com', ip: '192.168.1.104', status: 200, vulns: 1 },
  ],
  vulnerabilities: [
    { id: 1, title: 'SQL Injection', severity: 'critical', target: 'api.example.com/users' },
    { id: 2, title: 'XSS Reflected', severity: 'high', target: 'app.example.com/search' },
    { id: 3, title: 'Information Disclosure', severity: 'medium', target: 'dev.example.com' },
    { id: 4, title: 'Missing Security Headers', severity: 'low', target: 'example.com' },
  ],
  technologies: [
    { name: 'nginx', category: 'Web Server', count: 89 },
    { name: 'React', category: 'JavaScript Framework', count: 45 },
    { name: 'Node.js', category: 'Runtime', count: 34 },
    { name: 'AWS', category: 'Cloud', count: 23 },
    { name: 'Cloudflare', category: 'CDN/WAF', count: 12 },
  ],
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  return 'text-red-400';
};

export default function DomainDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const domain = domainData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/domains"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{domain.domain}</h1>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                domain.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              )}>
                {domain.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link href={`/dashboard/programs/${domain.program.id}`} className="text-sm text-primary-400 hover:text-primary-300">
                {domain.program.name}
              </Link>
              <span className="text-slate-500">•</span>
              <span className="text-sm text-slate-400">Last scan: {formatDateTime(domain.lastScan)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://${domain.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Site
          </a>
          <Link
            href="/dashboard/scans/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Scan
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Subdomains', value: domain.stats.subdomains, icon: Layers, color: 'text-blue-400' },
          { label: 'Alive', value: domain.stats.aliveSubdomains, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Open Ports', value: domain.stats.ports, icon: Server, color: 'text-purple-400' },
          { label: 'Vulnerabilities', value: domain.stats.vulnerabilities, icon: Shield, color: 'text-red-400' },
          { label: 'Endpoints', value: domain.stats.endpoints, icon: Globe, color: 'text-cyan-400' },
          { label: 'Technologies', value: domain.stats.technologies, icon: Settings, color: 'text-yellow-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">{stat.label}</p>
                <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800">
        {['overview', 'subdomains', 'vulnerabilities', 'technologies'].map((tab) => (
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
            <h3 className="text-lg font-semibold text-white mb-4">Recent Scans</h3>
            <div className="space-y-3">
              {domain.recentScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/dashboard/scans/${scan.id}`}
                  className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-white text-sm font-medium capitalize">{scan.type} Scan</p>
                      <p className="text-xs text-slate-500">{formatDateTime(scan.date)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-sm',
                    scan.vulns > 0 ? 'text-red-400' : 'text-slate-400'
                  )}>
                    {scan.vulns} vulns
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Top Vulnerabilities</h3>
            <div className="space-y-3">
              {domain.vulnerabilities.slice(0, 4).map((vuln) => (
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
                  <span className={cn('px-2 py-0.5 rounded text-xs uppercase', severityColors[vuln.severity])}>
                    {vuln.severity}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Subdomains Tab */}
      {activeTab === 'subdomains' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <h3 className="font-semibold text-white">Subdomains ({domain.stats.subdomains})</h3>
            <Link
              href="/dashboard/subdomains"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All →
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomain</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">IP</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerabilities</th>
              </tr>
            </thead>
            <tbody>
              {domain.topSubdomains.map((sub, index) => (
                <tr key={index} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{sub.subdomain}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400 font-mono text-sm">{sub.ip}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('font-mono text-sm', getStatusColor(sub.status))}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-sm font-medium',
                      sub.vulns > 0 ? 'text-red-400' : 'text-slate-400'
                    )}>
                      {sub.vulns}
                    </span>
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
              </tr>
            </thead>
            <tbody>
              {domain.vulnerabilities.map((vuln) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Technologies Tab */}
      {activeTab === 'technologies' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          <div className="grid grid-cols-3 gap-4">
            {domain.technologies.map((tech, index) => (
              <div key={index} className="p-4 bg-dark-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{tech.name}</span>
                  <span className="text-primary-400 font-bold">{tech.count}</span>
                </div>
                <span className="text-xs text-slate-500">{tech.category}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

