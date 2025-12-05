'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  Download,
  Globe,
  Shield,
  Calendar,
  CheckCircle,
  File,
  FileSpreadsheet,
  FileJson,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const reportTypes = [
  {
    id: 'full',
    name: 'Full Security Report',
    description: 'Comprehensive report with all findings, subdomains, vulnerabilities, and recommendations',
    icon: FileText,
  },
  {
    id: 'vulnerability',
    name: 'Vulnerability Report',
    description: 'Focused report on discovered vulnerabilities with severity ratings and remediation steps',
    icon: Shield,
  },
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview suitable for management with key metrics and risk assessment',
    icon: FileText,
  },
];

const formats = [
  { id: 'pdf', name: 'PDF', icon: File, description: 'Formatted document', color: 'text-red-400 bg-red-500/20' },
  { id: 'csv', name: 'CSV', icon: FileSpreadsheet, description: 'Spreadsheet data', color: 'text-green-400 bg-green-500/20' },
  { id: 'json', name: 'JSON', icon: FileJson, description: 'Raw data export', color: 'text-yellow-400 bg-yellow-500/20' },
];

const domains = [
  { id: '1', domain: 'example.com', vulns: 12, subdomains: 156 },
  { id: '2', domain: 'test.io', vulns: 5, subdomains: 89 },
  { id: '3', domain: 'demo.org', vulns: 3, subdomains: 45 },
  { id: '4', domain: 'app.net', vulns: 28, subdomains: 234 },
];

export default function NewReportPage() {
  const router = useRouter();
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [reportType, setReportType] = useState('full');
  const [format, setFormat] = useState('pdf');
  const [dateRange, setDateRange] = useState('all');
  const [includeOptions, setIncludeOptions] = useState({
    subdomains: true,
    vulnerabilities: true,
    endpoints: true,
    technologies: true,
    screenshots: false,
    rawData: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleDomain = (id: string) => {
    setSelectedDomains(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedDomains(domains.map(d => d.id));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    router.push('/dashboard/reports');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/reports"
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary-400" />
            Generate Report
          </h1>
          <p className="text-slate-400 mt-1">Create a new security report</p>
        </div>
      </div>

      {/* Select Domains */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-400" />
            Select Domains
          </h2>
          <button
            onClick={selectAll}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            Select All
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => toggleDomain(domain.id)}
              className={cn(
                'p-4 rounded-lg border text-left transition-all',
                selectedDomains.includes(domain.id)
                  ? 'bg-primary-500/20 border-primary-500/50'
                  : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className={cn(
                    'w-5 h-5',
                    selectedDomains.includes(domain.id) ? 'text-primary-400' : 'text-slate-500'
                  )} />
                  <div>
                    <p className="font-medium text-white">{domain.domain}</p>
                    <p className="text-xs text-slate-500">
                      {domain.vulns} vulns • {domain.subdomains} subdomains
                    </p>
                  </div>
                </div>
                {selectedDomains.includes(domain.id) && (
                  <CheckCircle className="w-5 h-5 text-primary-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Report Type */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-400" />
          Report Type
        </h2>

        <div className="space-y-3">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-all',
                reportType === type.id
                  ? 'bg-primary-500/20 border-primary-500/50'
                  : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
              )}
            >
              <div className="flex items-center gap-3">
                <type.icon className={cn(
                  'w-5 h-5',
                  reportType === type.id ? 'text-primary-400' : 'text-slate-500'
                )} />
                <div>
                  <p className="font-medium text-white">{type.name}</p>
                  <p className="text-sm text-slate-400">{type.description}</p>
                </div>
                {reportType === type.id && (
                  <CheckCircle className="w-5 h-5 text-primary-400 ml-auto" />
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Format & Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Format & Options</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Output Format</h3>
            <div className="flex gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                    format === f.id
                      ? 'bg-primary-500/20 border-primary-500/50'
                      : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                  )}
                >
                  <f.icon className={cn('w-4 h-4', f.color.split(' ')[0])} />
                  <span className="text-white">{f.name}</span>
                </button>
              ))}
            </div>

            <h3 className="text-sm font-medium text-slate-400 mb-3 mt-6">Date Range</h3>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Include Sections</h3>
            <div className="space-y-2">
              {Object.entries(includeOptions).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setIncludeOptions({ ...includeOptions, [key]: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Generate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Ready to generate</h3>
            <p className="text-sm text-slate-400 mt-1">
              {selectedDomains.length > 0 ? (
                <>{selectedDomains.length} domain(s) selected • {reportTypes.find(t => t.id === reportType)?.name} • {format.toUpperCase()}</>
              ) : (
                'Please select at least one domain'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/reports" className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
              Cancel
            </Link>
            <button
              onClick={handleGenerate}
              disabled={selectedDomains.length === 0 || isGenerating}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                selectedDomains.length > 0 && !isGenerating
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

