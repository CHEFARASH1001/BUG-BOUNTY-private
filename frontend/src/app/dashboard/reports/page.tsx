'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  Globe,
  Shield,
  Eye,
  Trash2,
  FileJson,
  FileSpreadsheet,
  File,
  Clock,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime, formatDate } from '@/lib/utils';
import { useIsMobile } from '@/hooks';

// Mock data
const reports = [
  {
    id: '1',
    title: 'Example Corp - Full Security Assessment',
    domain: 'example.com',
    type: 'full',
    format: 'pdf',
    status: 'ready',
    createdAt: '2024-01-15T12:00:00Z',
    size: '2.4 MB',
    vulnerabilities: 12,
    subdomains: 156,
  },
  {
    id: '2',
    title: 'Test.io - Vulnerability Report',
    domain: 'test.io',
    type: 'vulnerability',
    format: 'pdf',
    status: 'ready',
    createdAt: '2024-01-14T15:30:00Z',
    size: '1.8 MB',
    vulnerabilities: 5,
    subdomains: 89,
  },
  {
    id: '3',
    title: 'Example Corp - Subdomain Export',
    domain: 'example.com',
    type: 'subdomain',
    format: 'csv',
    status: 'ready',
    createdAt: '2024-01-13T09:00:00Z',
    size: '156 KB',
    vulnerabilities: 0,
    subdomains: 156,
  },
  {
    id: '4',
    title: 'App.net - JSON Data Export',
    domain: 'app.net',
    type: 'data',
    format: 'json',
    status: 'generating',
    createdAt: '2024-01-15T11:00:00Z',
    size: null,
    vulnerabilities: 28,
    subdomains: 234,
  },
  {
    id: '5',
    title: 'Demo.org - Weekly Summary',
    domain: 'demo.org',
    type: 'summary',
    format: 'pdf',
    status: 'ready',
    createdAt: '2024-01-12T08:00:00Z',
    size: '856 KB',
    vulnerabilities: 3,
    subdomains: 45,
  },
];

const formatConfig: Record<string, { icon: any; color: string; label: string }> = {
  pdf: { icon: File, color: 'text-red-400', label: 'PDF' },
  csv: { icon: FileSpreadsheet, color: 'text-green-400', label: 'CSV' },
  json: { icon: FileJson, color: 'text-yellow-400', label: 'JSON' },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  full: { color: 'bg-purple-500/20 text-purple-400', label: 'Full Report' },
  vulnerability: { color: 'bg-red-500/20 text-red-400', label: 'Vulnerability' },
  subdomain: { color: 'bg-blue-500/20 text-blue-400', label: 'Subdomain' },
  data: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Data Export' },
  summary: { color: 'bg-green-500/20 text-green-400', label: 'Summary' },
};

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || report.type === selectedType;
    const matchesFormat = !selectedFormat || report.format === selectedFormat;
    return matchesSearch && matchesType && matchesFormat;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
            <FileText className="w-6 h-6 md:w-7 md:h-7 text-primary-400" />
            Reports
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Generate and download security reports</p>
        </div>
        <Link
          href="/dashboard/reports/new"
          className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors touch-manipulation w-full sm:w-auto"
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 min-h-[44px] bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-primary-500/50 transition-colors text-left group touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors shrink-0">
              <File className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">PDF Report</h3>
              <p className="text-xs text-slate-500">Full formatted report</p>
            </div>
          </div>
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 min-h-[44px] bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-primary-500/50 transition-colors text-left group touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">CSV Export</h3>
              <p className="text-xs text-slate-500">Spreadsheet format</p>
            </div>
          </div>
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 min-h-[44px] bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-primary-500/50 transition-colors text-left group touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:bg-yellow-500/30 transition-colors shrink-0">
              <FileJson className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">JSON Export</h3>
              <p className="text-xs text-slate-500">Raw data format</p>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors touch-manipulation"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="flex-1 sm:flex-none px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50 touch-manipulation"
          >
            <option value="">All Types</option>
            <option value="full">Full Report</option>
            <option value="vulnerability">Vulnerability</option>
            <option value="subdomain">Subdomain</option>
            <option value="data">Data Export</option>
            <option value="summary">Summary</option>
          </select>
          <select
            value={selectedFormat || ''}
            onChange={(e) => setSelectedFormat(e.target.value || null)}
            className="flex-1 sm:flex-none px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50 touch-manipulation"
          >
            <option value="">All Formats</option>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
        {/* Mobile Card View */}
        {isMobile ? (
          <div className="divide-y divide-dark-800">
            {filteredReports.map((report, index) => {
              const FormatIcon = formatConfig[report.format].icon;
              
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-2 rounded-lg shrink-0',
                      report.format === 'pdf' ? 'bg-red-500/20' :
                      report.format === 'csv' ? 'bg-green-500/20' :
                      'bg-yellow-500/20'
                    )}>
                      <FormatIcon className={cn('w-4 h-4', formatConfig[report.format].color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">{report.title}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <Globe className="w-3 h-3" />
                        {report.domain}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('px-2 py-1 rounded text-xs', typeConfig[report.type].color)}>
                      {typeConfig[report.type].label}
                    </span>
                    <span className={cn('text-xs font-medium', formatConfig[report.format].color)}>
                      {formatConfig[report.format].label}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {report.vulnerabilities} vulns
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {report.subdomains} subs
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(report.createdAt)}
                    </span>
                    {report.status === 'generating' ? (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Clock className="w-3 h-3 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      <span>{report.size}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {report.status === 'ready' && (
                      <>
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs rounded-lg transition-colors touch-manipulation"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        <button
                          className="flex items-center justify-center p-2 min-w-[44px] min-h-[44px] bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white rounded-lg transition-colors touch-manipulation"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      className="flex items-center justify-center p-2 min-w-[44px] min-h-[44px] bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-red-400 rounded-lg transition-colors touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Report</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Format</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Stats</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Size</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report, index) => {
                  const FormatIcon = formatConfig[report.format].icon;
                  
                  return (
                    <motion.tr
                      key={report.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'p-2 rounded-lg',
                            report.format === 'pdf' ? 'bg-red-500/20' :
                            report.format === 'csv' ? 'bg-green-500/20' :
                            'bg-yellow-500/20'
                          )}>
                            <FormatIcon className={cn('w-4 h-4', formatConfig[report.format].color)} />
                          </div>
                          <div>
                            <div className="font-medium text-white">{report.title}</div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Globe className="w-3 h-3" />
                              {report.domain}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('px-2 py-1 rounded text-xs', typeConfig[report.type].color)}>
                          {typeConfig[report.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('text-sm font-medium', formatConfig[report.format].color)}>
                          {formatConfig[report.format].label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Shield className="w-3 h-3" />
                            {report.vulnerabilities}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Globe className="w-3 h-3" />
                            {report.subdomains}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(report.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {report.status === 'generating' ? (
                          <span className="flex items-center gap-1 text-sm text-yellow-400">
                            <Clock className="w-3 h-3 animate-spin" />
                            Generating...
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">{report.size}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {report.status === 'ready' && (
                            <>
                              <button
                                className="p-1.5 text-slate-400 hover:text-green-400 transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                title="Preview"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No reports found</h3>
          <p className="text-slate-400 mb-4">Generate a new report to get started</p>
          <Link
            href="/dashboard/reports/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors touch-manipulation"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </Link>
        </div>
      )}
    </div>
  );
}

