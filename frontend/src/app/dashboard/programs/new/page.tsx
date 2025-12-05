'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Plus,
  Globe,
  DollarSign,
  Link as LinkIcon,
  Shield,
  CheckCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const platforms = [
  { id: 'hackerone', name: 'HackerOne', color: 'bg-purple-500/20 text-purple-400' },
  { id: 'bugcrowd', name: 'Bugcrowd', color: 'bg-orange-500/20 text-orange-400' },
  { id: 'synack', name: 'Synack', color: 'bg-blue-500/20 text-blue-400' },
  { id: 'intigriti', name: 'Intigriti', color: 'bg-green-500/20 text-green-400' },
  { id: 'yeswehack', name: 'YesWeHack', color: 'bg-red-500/20 text-red-400' },
  { id: 'self', name: 'Self-hosted', color: 'bg-slate-500/20 text-slate-400' },
];

export default function NewProgramPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    platform: 'hackerone',
    type: 'public',
    programUrl: '',
    description: '',
    minBounty: '',
    maxBounty: '',
  });

  const [scope, setScope] = useState<string[]>(['']);
  const [outOfScope, setOutOfScope] = useState<string[]>(['']);

  const addScopeItem = () => setScope([...scope, '']);
  const addOutOfScopeItem = () => setOutOfScope([...outOfScope, '']);
  
  const updateScope = (index: number, value: string) => {
    const newScope = [...scope];
    newScope[index] = value;
    setScope(newScope);
  };

  const updateOutOfScope = (index: number, value: string) => {
    const newOutOfScope = [...outOfScope];
    newOutOfScope[index] = value;
    setOutOfScope(newOutOfScope);
  };

  const removeScope = (index: number) => {
    setScope(scope.filter((_, i) => i !== index));
  };

  const removeOutOfScope = (index: number) => {
    setOutOfScope(outOfScope.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.name) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    router.push('/dashboard/programs');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/programs"
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary-400" />
            New Program
          </h1>
          <p className="text-slate-400 mt-1">Add a new bug bounty program</p>
        </div>
      </div>

      {/* Basic Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-400" />
          Basic Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Program Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Example Corp Bug Bounty"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50"
              >
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Type</label>
              <div className="flex gap-2">
                {['public', 'private'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, type })}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all capitalize',
                      formData.type === type
                        ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                        : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Program URL</label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={formData.programUrl}
                onChange={(e) => setFormData({ ...formData, programUrl: e.target.value })}
                placeholder="https://hackerone.com/example"
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the program..."
              rows={3}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 resize-none"
            />
          </div>
        </div>
      </motion.div>

      {/* Bounty Range */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary-400" />
          Bounty Range
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Minimum ($)</label>
            <input
              type="number"
              value={formData.minBounty}
              onChange={(e) => setFormData({ ...formData, minBounty: e.target.value })}
              placeholder="100"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Maximum ($)</label>
            <input
              type="number"
              value={formData.maxBounty}
              onChange={(e) => setFormData({ ...formData, maxBounty: e.target.value })}
              placeholder="10000"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
            />
          </div>
        </div>
      </motion.div>

      {/* Scope */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          Scope
        </h2>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-slate-400">In Scope</label>
              <button
                onClick={addScopeItem}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {scope.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateScope(index, e.target.value)}
                    placeholder="*.example.com"
                    className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 text-sm"
                  />
                  {scope.length > 1 && (
                    <button
                      onClick={() => removeScope(index)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-slate-400">Out of Scope</label>
              <button
                onClick={addOutOfScopeItem}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {outOfScope.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateOutOfScope(index, e.target.value)}
                    placeholder="blog.example.com"
                    className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 text-sm"
                  />
                  {outOfScope.length > 1 && (
                    <button
                      onClick={() => removeOutOfScope(index)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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
            <h3 className="text-white font-medium">Ready to create</h3>
            <p className="text-sm text-slate-400 mt-1">
              {formData.name ? (
                <>Program: <span className="text-primary-400">{formData.name}</span></>
              ) : (
                'Please enter a program name'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/programs" className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={!formData.name || isSubmitting}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                formData.name && !isSubmitting
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Program
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

