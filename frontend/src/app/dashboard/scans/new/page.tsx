'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Scan,
  Globe,
  ArrowLeft,
  Play,
  Settings,
  Zap,
  Shield,
  Layers,
  Server,
  Search,
  CheckCircle,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const scanTypes = [
  {
    id: 'full',
    name: 'Full Scan',
    description: 'Complete reconnaissance including subdomain enumeration, port scanning, and vulnerability detection',
    icon: Shield,
    duration: '2-4 hours',
    recommended: true,
    features: ['Subdomain enumeration', 'DNS resolution', 'Port scanning', 'HTTP probing', 'Technology detection', 'Vulnerability scanning'],
  },
  {
    id: 'quick',
    name: 'Quick Scan',
    description: 'Fast scan focusing on common ports and known vulnerabilities',
    icon: Zap,
    duration: '15-30 minutes',
    recommended: false,
    features: ['Top 100 ports', 'Common vulnerabilities', 'Basic recon'],
  },
  {
    id: 'subdomain',
    name: 'Subdomain Only',
    description: 'Enumerate subdomains using multiple sources',
    icon: Layers,
    duration: '10-20 minutes',
    recommended: false,
    features: ['Passive enumeration', 'DNS bruteforce', 'Certificate transparency'],
  },
  {
    id: 'vulnerability',
    name: 'Vulnerability Scan',
    description: 'Run vulnerability templates against known targets',
    icon: Search,
    duration: '30-60 minutes',
    recommended: false,
    features: ['Nuclei templates', 'Custom checks', 'CVE detection'],
  },
];

const domains = [
  { id: '1', domain: 'example.com', program: 'Example Corp' },
  { id: '2', domain: 'test.io', program: 'Test Inc' },
  { id: '3', domain: 'demo.org', program: 'Demo Labs' },
  { id: '4', domain: 'app.net', program: 'App Network' },
];

export default function NewScanPage() {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState('full');
  const [customDomain, setCustomDomain] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [options, setOptions] = useState({
    subdomainEnum: true,
    dnsResolution: true,
    portScan: true,
    httpProbe: true,
    techDetect: true,
    vulnScan: true,
    screenshot: false,
    wafDetect: true,
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    router.push('/dashboard/scans');
  };

  const targetDomain = useCustom ? customDomain : domains.find(d => d.id === selectedDomain)?.domain;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/scans"
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scan className="w-7 h-7 text-primary-400" />
            New Scan
          </h1>
          <p className="text-slate-400 mt-1">Configure and start a new security scan</p>
        </div>
      </div>

      {/* Step 1: Select Target */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          Step 1: Select Target
        </h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setUseCustom(false)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                !useCustom ? 'bg-primary-600 text-white' : 'bg-dark-800 text-slate-400 hover:text-white'
              )}
            >
              Select from domains
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                useCustom ? 'bg-primary-600 text-white' : 'bg-dark-800 text-slate-400 hover:text-white'
              )}
            >
              Enter custom domain
            </button>
          </div>

          {!useCustom ? (
            <div className="grid grid-cols-2 gap-3">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  onClick={() => setSelectedDomain(domain.id)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    selectedDomain === domain.id
                      ? 'bg-primary-500/20 border-primary-500/50'
                      : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Globe className={cn(
                      'w-5 h-5',
                      selectedDomain === domain.id ? 'text-primary-400' : 'text-slate-500'
                    )} />
                    <div>
                      <p className="font-medium text-white">{domain.domain}</p>
                      <p className="text-xs text-slate-500">{domain.program}</p>
                    </div>
                    {selectedDomain === domain.id && (
                      <CheckCircle className="w-4 h-4 text-primary-400 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Enter domain (e.g., example.com)"
                className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Step 2: Select Scan Type */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-400" />
          Step 2: Select Scan Type
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {scanTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={cn(
                'p-4 rounded-lg border text-left transition-all relative',
                selectedType === type.id
                  ? 'bg-primary-500/20 border-primary-500/50'
                  : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
              )}
            >
              {type.recommended && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                  Recommended
                </span>
              )}
              <div className="flex items-start gap-3">
                <type.icon className={cn(
                  'w-6 h-6 mt-0.5',
                  selectedType === type.id ? 'text-primary-400' : 'text-slate-500'
                )} />
                <div>
                  <p className="font-medium text-white">{type.name}</p>
                  <p className="text-sm text-slate-400 mt-1">{type.description}</p>
                  <p className="text-xs text-slate-500 mt-2">Duration: {type.duration}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {type.features.slice(0, 3).map((feature) => (
                      <span key={feature} className="px-1.5 py-0.5 bg-dark-800 text-xs text-slate-400 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Step 3: Advanced Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary-400" />
          Step 3: Advanced Options
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'subdomainEnum', label: 'Subdomain Enumeration', desc: 'Find subdomains using multiple sources' },
            { key: 'dnsResolution', label: 'DNS Resolution', desc: 'Resolve IPs and DNS records' },
            { key: 'portScan', label: 'Port Scanning', desc: 'Scan for open ports' },
            { key: 'httpProbe', label: 'HTTP Probing', desc: 'Check HTTP/HTTPS services' },
            { key: 'techDetect', label: 'Technology Detection', desc: 'Identify web technologies' },
            { key: 'vulnScan', label: 'Vulnerability Scanning', desc: 'Run Nuclei templates' },
            { key: 'screenshot', label: 'Screenshots', desc: 'Capture page screenshots' },
            { key: 'wafDetect', label: 'WAF Detection', desc: 'Identify WAF/CDN' },
          ].map((option) => (
            <label
              key={option.key}
              className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg cursor-pointer hover:bg-dark-800 transition-colors"
            >
              <input
                type="checkbox"
                checked={options[option.key as keyof typeof options]}
                onChange={(e) => setOptions({ ...options, [option.key]: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-white">{option.label}</p>
                <p className="text-xs text-slate-500">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </motion.div>

      {/* Summary & Submit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Ready to scan</h3>
            <p className="text-sm text-slate-400 mt-1">
              {targetDomain ? (
                <>Target: <span className="text-primary-400">{targetDomain}</span> • Type: <span className="text-primary-400">{scanTypes.find(t => t.id === selectedType)?.name}</span></>
              ) : (
                'Please select a target domain'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/scans"
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={!targetDomain || isSubmitting}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                targetDomain && !isSubmitting
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Scan
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

