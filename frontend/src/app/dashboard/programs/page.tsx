'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Globe,
  DollarSign,
  Calendar,
  ExternalLink,
  Users,
  Target,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';

// Mock data
const programs = [
  {
    id: '1',
    name: 'Example Corp Bug Bounty',
    platform: 'HackerOne',
    type: 'public',
    status: 'active',
    domains: 5,
    vulnerabilities: 23,
    bountyRange: '$100 - $10,000',
    startDate: '2023-06-15',
    description: 'Find and report security vulnerabilities in Example Corp\'s web applications.',
    scope: ['*.example.com', 'api.example.com', 'app.example.com'],
  },
  {
    id: '2',
    name: 'Test Inc Security Program',
    platform: 'Bugcrowd',
    type: 'private',
    status: 'active',
    domains: 3,
    vulnerabilities: 12,
    bountyRange: '$250 - $15,000',
    startDate: '2023-09-01',
    description: 'Private bug bounty program for Test Inc infrastructure.',
    scope: ['test.io', 'secure.test.io'],
  },
  {
    id: '3',
    name: 'Demo Labs VDP',
    platform: 'Self-hosted',
    type: 'public',
    status: 'paused',
    domains: 2,
    vulnerabilities: 5,
    bountyRange: 'Swag only',
    startDate: '2024-01-01',
    description: 'Vulnerability disclosure program for Demo Labs.',
    scope: ['demo.org'],
  },
  {
    id: '4',
    name: 'App Network Pentest',
    platform: 'Synack',
    type: 'private',
    status: 'inactive',
    domains: 8,
    vulnerabilities: 45,
    bountyRange: '$500 - $25,000',
    startDate: '2022-03-20',
    description: 'Comprehensive security testing program.',
    scope: ['*.app.net', 'internal.app.net'],
  },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Paused' },
  inactive: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Inactive' },
};

const platformColors: Record<string, string> = {
  HackerOne: 'bg-purple-500/20 text-purple-400',
  Bugcrowd: 'bg-orange-500/20 text-orange-400',
  Synack: 'bg-blue-500/20 text-blue-400',
  'Self-hosted': 'bg-slate-500/20 text-slate-400',
};

export default function ProgramsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredPrograms = programs.filter((program) => {
    const matchesSearch = program.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !selectedStatus || program.status === selectedStatus;
    const matchesType = !selectedType || program.type === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary-400" />
            Programs
          </h1>
          <p className="text-slate-400 mt-1">Manage your bug bounty programs</p>
        </div>
        <Link
          href="/dashboard/programs/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Program
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Programs', value: programs.length, icon: Building2, color: 'text-primary-400' },
          { label: 'Active', value: programs.filter(p => p.status === 'active').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Domains', value: programs.reduce((a, b) => a + b.domains, 0), icon: Globe, color: 'text-blue-400' },
          { label: 'Vulnerabilities', value: programs.reduce((a, b) => a + b.vulnerabilities, 0), icon: Shield, color: 'text-red-400' },
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      {/* Programs List */}
      <div className="space-y-4">
        {filteredPrograms.map((program, index) => (
          <motion.div
            key={program.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-300" />
            <div className="relative p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-500/20 rounded-xl">
                    <Building2 className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Link
                        href={`/dashboard/programs/${program.id}`}
                        className="text-lg font-semibold text-white hover:text-primary-400 transition-colors"
                      >
                        {program.name}
                      </Link>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        statusConfig[program.status].bg,
                        statusConfig[program.status].color
                      )}>
                        {statusConfig[program.status].label}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        program.type === 'private' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                      )}>
                        {program.type === 'private' ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3 max-w-2xl">{program.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={cn('px-2 py-1 rounded text-xs', platformColors[program.platform])}>
                        {program.platform}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Globe className="w-4 h-4" />
                        {program.domains} domains
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Shield className="w-4 h-4" />
                        {program.vulnerabilities} vulns
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <DollarSign className="w-4 h-4" />
                        {program.bountyRange}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        Started {formatDate(program.startDate)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/programs/${program.id}`}
                    className="p-2 text-slate-400 hover:text-primary-400 transition-colors"
                    title="View Details"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button className="p-2 text-slate-400 hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scope preview */}
              <div className="mt-4 pt-4 border-t border-dark-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Scope:</span>
                  {program.scope.slice(0, 3).map((s) => (
                    <span key={s} className="px-2 py-1 bg-dark-800 text-xs text-slate-300 rounded">
                      {s}
                    </span>
                  ))}
                  {program.scope.length > 3 && (
                    <span className="text-xs text-slate-500">+{program.scope.length - 3} more</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredPrograms.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No programs found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery ? 'Try adjusting your search query' : 'Add your first program to get started'}
          </p>
          <Link
            href="/dashboard/programs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Program
          </Link>
        </div>
      )}
    </div>
  );
}

