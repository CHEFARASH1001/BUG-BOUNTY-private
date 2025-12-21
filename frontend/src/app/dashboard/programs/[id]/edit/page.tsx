'use client';

import { useState, useEffect } from 'react';
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
  AlertTriangle,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { programsApi } from '@/lib/api';

const platforms = [
  { id: 'hackerone', name: 'HackerOne', color: 'bg-purple-500/20 text-purple-400' },
  { id: 'bugcrowd', name: 'Bugcrowd', color: 'bg-orange-500/20 text-orange-400' },
  { id: 'synack', name: 'Synack', color: 'bg-blue-500/20 text-blue-400' },
  { id: 'intigriti', name: 'Intigriti', color: 'bg-green-500/20 text-green-400' },
  { id: 'yeswehack', name: 'YesWeHack', color: 'bg-red-500/20 text-red-400' },
  { id: 'custom', name: 'Self-hosted', color: 'bg-slate-500/20 text-slate-400' },
];

export default function EditProgramPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    platform: 'hackerone',
    status: 'active',
    platformUrl: '',
    description: '',
    notes: '',
    minBounty: '',
    maxBounty: '',
  });

  const [scope, setScope] = useState<string[]>(['']);
  const [outOfScope, setOutOfScope] = useState<string[]>(['']);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        const response = await programsApi.getById(params.id);
        const program = response.data;
        
        setFormData({
          name: program.name || '',
          platform: program.platform || 'hackerone',
          status: program.status || 'active',
          platformUrl: program.platformUrl || program.url || '',
          description: program.description || '',
          notes: program.notes || '',
          minBounty: program.bountyRange?.min?.toString() || '',
          maxBounty: program.bountyRange?.max?.toString() || '',
        });
        
        setScope(program.scope?.length > 0 ? program.scope : ['']);
        setOutOfScope(program.outOfScope?.length > 0 ? program.outOfScope : ['']);
        setTags(program.tags || []);
      } catch (err: any) {
        console.error('Failed to fetch program:', err);
        setError(err.response?.data?.message || 'Failed to load program');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgram();
  }, [params.id]);

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

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    if (!formData.name) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await programsApi.update(params.id, {
        name: formData.name,
        description: formData.description || undefined,
        notes: formData.notes || undefined,
        platform: formData.platform,
        status: formData.status,
        platformUrl: formData.platformUrl || undefined,
        scope: scope.filter(s => s.trim() !== ''),
        outOfScope: outOfScope.filter(s => s.trim() !== ''),
        tags,
        bountyRange: formData.minBounty || formData.maxBounty ? {
          min: formData.minBounty ? parseInt(formData.minBounty) : undefined,
          max: formData.maxBounty ? parseInt(formData.maxBounty) : undefined,
          currency: '$',
        } : undefined,
      });
      router.push(`/dashboard/programs/${params.id}`);
    } catch (err: any) {
      console.error('Failed to update program:', err);
      setError(err.response?.data?.message || 'Failed to update program');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading program...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/programs/${params.id}`}
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary-400" />
            Edit Program
          </h1>
          <p className="text-slate-400 mt-1">Update program settings</p>
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
              <label className="block text-sm text-slate-400 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Program URL</label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={formData.platformUrl}
                onChange={(e) => setFormData({ ...formData, platformUrl: e.target.value })}
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

          <div>
            <label className="block text-sm text-slate-400 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Private notes about this program..."
              rows={2}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-primary-500/20 text-primary-400 text-sm rounded flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 text-sm"
              />
              <button
                onClick={addTag}
                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
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
          Manual Scope Rules
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Note: Synced scopes from the platform are managed separately. These are additional manual rules.
        </p>

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
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Save Changes</h3>
            <p className="text-sm text-slate-400 mt-1">
              Program: <span className="text-primary-400">{formData.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href={`/dashboard/programs/${params.id}`} 
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

