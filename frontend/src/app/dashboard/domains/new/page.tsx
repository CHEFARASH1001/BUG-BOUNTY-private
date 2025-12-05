'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  ArrowLeft,
  Plus,
  Building2,
  Shield,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const programs = [
  { id: '1', name: 'Example Corp Bug Bounty', platform: 'HackerOne' },
  { id: '2', name: 'Test Inc Security Program', platform: 'Bugcrowd' },
  { id: '3', name: 'Demo Labs VDP', platform: 'Self-hosted' },
  { id: '4', name: 'App Network Pentest', platform: 'Synack' },
];

export default function NewDomainPage() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');

  const validateDomain = (value: string) => {
    if (!value) {
      setValidationStatus('idle');
      return;
    }
    
    setValidationStatus('validating');
    
    // Simulate validation
    setTimeout(() => {
      const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      setValidationStatus(pattern.test(value) ? 'valid' : 'invalid');
    }, 500);
  };

  const handleSubmit = async () => {
    if (validationStatus !== 'valid' || !selectedProgram) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    router.push('/dashboard/domains');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/domains"
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-400" />
            Add Domain
          </h1>
          <p className="text-slate-400 mt-1">Add a new target domain for reconnaissance</p>
        </div>
      </div>

      {/* Domain Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          Domain
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Root Domain</label>
            <div className="relative">
              <input
                type="text"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  validateDomain(e.target.value);
                }}
                placeholder="example.com"
                className={cn(
                  'w-full px-4 py-3 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors',
                  validationStatus === 'valid' ? 'border-green-500/50 focus:border-green-500' :
                  validationStatus === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
                  'border-dark-700 focus:border-primary-500/50'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validationStatus === 'validating' && (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                )}
                {validationStatus === 'valid' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {validationStatus === 'invalid' && (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
            {validationStatus === 'invalid' && (
              <p className="text-sm text-red-400 mt-2">Please enter a valid domain name</p>
            )}
          </div>

          <div className="p-4 bg-dark-800/50 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-slate-300">Enter the root domain without protocol or path</p>
              <p className="text-slate-500 mt-1">Example: example.com, not https://example.com/page</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Select Program */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-400" />
          Assign to Program
        </h2>

        <div className="space-y-3">
          {programs.map((program) => (
            <button
              key={program.id}
              onClick={() => setSelectedProgram(program.id)}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-all',
                selectedProgram === program.id
                  ? 'bg-primary-500/20 border-primary-500/50'
                  : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className={cn(
                    'w-5 h-5',
                    selectedProgram === program.id ? 'text-primary-400' : 'text-slate-500'
                  )} />
                  <div>
                    <p className="font-medium text-white">{program.name}</p>
                    <p className="text-xs text-slate-500">{program.platform}</p>
                  </div>
                </div>
                {selectedProgram === program.id && (
                  <CheckCircle className="w-5 h-5 text-primary-400" />
                )}
              </div>
            </button>
          ))}
        </div>

        <Link
          href="/dashboard/programs/new"
          className="flex items-center gap-2 mt-4 text-sm text-primary-400 hover:text-primary-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create new program
        </Link>
      </motion.div>

      {/* Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          Scan Options
        </h2>

        <label className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-white font-medium">Start scan automatically</p>
              <p className="text-sm text-slate-400">Begin reconnaissance immediately after adding</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoScan}
            onChange={(e) => setAutoScan(e.target.checked)}
            className="w-5 h-5 rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
          />
        </label>
      </motion.div>

      {/* Submit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Ready to add</h3>
            <p className="text-sm text-slate-400 mt-1">
              {domain && validationStatus === 'valid' && selectedProgram ? (
                <>Domain: <span className="text-primary-400">{domain}</span> • {autoScan ? 'Will start scanning' : 'Manual scan'}</>
              ) : (
                'Please fill in all required fields'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/domains" className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={validationStatus !== 'valid' || !selectedProgram || isSubmitting}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                validationStatus === 'valid' && selectedProgram && !isSubmitting
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Domain
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

