'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  Server,
  Shield,
  Cpu,
  Lock,
  Wrench,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Layers,
  Network,
  Cloud,
  Code,
  FileCode,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types based on backend interfaces
export type TargetType =
  | 'web_application'
  | 'network_host'
  | 'api_endpoint'
  | 'cloud_service'
  | 'binary_file'
  | 'unknown';

export type RiskLevel =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'minimal'
  | 'unknown';

export interface TargetProfile {
  target: string;
  targetType: TargetType;
  ipAddresses: string[];
  openPorts: number[];
  services: Record<number, string>;
  technologies: string[];
  cmsType?: string;
  cloudProvider?: string;
  securityHeaders: Record<string, string>;
  sslInfo: Record<string, any>;
  subdomains: string[];
  endpoints: string[];
  attackSurfaceScore: number;
  riskLevel: RiskLevel;
  confidenceScore: number;
  recommendedTools?: string[];
}

// Risk level color mapping - consistent with design document Property 6
export const getRiskLevelColor = (level: RiskLevel) => {
  switch (level) {
    case 'critical':
      return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
    case 'high':
      return { text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' };
    case 'medium':
      return { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' };
    case 'low':
      return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' };
    case 'minimal':
      return { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' };
    default:
      return { text: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30' };
  }
};

// Attack surface score color based on severity
export const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-blue-400';
  return 'text-green-400';
};

// Target type icon mapping
export const getTargetTypeIcon = (type: TargetType) => {
  switch (type) {
    case 'web_application':
      return Globe;
    case 'network_host':
      return Network;
    case 'api_endpoint':
      return Code;
    case 'cloud_service':
      return Cloud;
    case 'binary_file':
      return FileCode;
    default:
      return HelpCircle;
  }
};

// Target type display name
export const getTargetTypeLabel = (type: TargetType) => {
  switch (type) {
    case 'web_application':
      return 'Web Application';
    case 'network_host':
      return 'Network Host';
    case 'api_endpoint':
      return 'API Endpoint';
    case 'cloud_service':
      return 'Cloud Service';
    case 'binary_file':
      return 'Binary File';
    default:
      return 'Unknown';
  }
};

interface TargetProfileDisplayProps {
  profile: TargetProfile;
  showActions?: boolean;
}

/**
 * TargetProfileDisplay Component
 * 
 * Renders a comprehensive view of a target profile including:
 * - IP addresses, ports, technologies
 * - Attack surface score with color coding
 * - Risk level indicator
 * - Recommended tools
 * 
 * Validates: Requirements 3.3, 3.4, 3.5
 */
export function TargetProfileDisplay({ profile, showActions = true }: TargetProfileDisplayProps) {
  const riskColors = getRiskLevelColor(profile.riskLevel);
  const TargetIcon = getTargetTypeIcon(profile.targetType);
  
  // Ensure arrays have default values to prevent undefined errors
  const ipAddresses = profile.ipAddresses || [];
  const openPorts = profile.openPorts || [];
  const technologies = profile.technologies || [];
  const subdomains = profile.subdomains || [];
  const endpoints = profile.endpoints || [];
  const services = profile.services || {};
  const securityHeaders = profile.securityHeaders || {};
  const sslInfo = profile.sslInfo || {};
  const recommendedTools = profile.recommendedTools || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="target-profile-display"
    >
      {/* Overview Card */}
      <div className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-lg', riskColors.bg)} data-testid="target-type-icon">
              <TargetIcon className={cn('w-6 h-6', riskColors.text)} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white" data-testid="target-name">{profile.target}</h2>
              <p className="text-slate-400 text-sm" data-testid="target-type">{getTargetTypeLabel(profile.targetType)}</p>
            </div>
          </div>
          <div className="text-right">
            <div 
              className={cn('text-3xl font-bold', getScoreColor(profile.attackSurfaceScore))}
              data-testid="attack-surface-score"
            >
              {profile.attackSurfaceScore}
            </div>
            <p className="text-xs text-slate-500">Attack Surface Score</p>
          </div>
        </div>

        {/* Risk Level & Confidence */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn('p-4 rounded-lg border', riskColors.bg, riskColors.border)} data-testid="risk-level-card">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className={cn('w-4 h-4', riskColors.text)} />
              <span className="text-xs text-slate-400">Risk Level</span>
            </div>
            <p className={cn('text-lg font-semibold capitalize', riskColors.text)} data-testid="risk-level">
              {profile.riskLevel}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-dark-800/50 border border-dark-700">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Confidence</span>
            </div>
            <p className="text-lg font-semibold text-white" data-testid="confidence-score">{profile.confidenceScore}%</p>
          </div>
          <div className="p-4 rounded-lg bg-dark-800/50 border border-dark-700">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Open Ports</span>
            </div>
            <p className="text-lg font-semibold text-white" data-testid="open-ports-count">{openPorts.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-dark-800/50 border border-dark-700">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">Technologies</span>
            </div>
            <p className="text-lg font-semibold text-white" data-testid="technologies-count">{technologies.length}</p>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IP Addresses */}
        {ipAddresses.length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="ip-addresses-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-400" />
              IP Addresses
            </h3>
            <div className="flex flex-wrap gap-2" data-testid="ip-addresses-list">
              {ipAddresses.map((ip) => (
                <span
                  key={ip}
                  className="px-3 py-1.5 bg-dark-800 rounded-lg text-sm text-slate-300 font-mono"
                  data-testid="ip-address"
                >
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Open Ports & Services */}
        {openPorts.length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="ports-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary-400" />
              Open Ports & Services
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto" data-testid="ports-list">
              {openPorts.map((port) => (
                <div
                  key={port}
                  className="flex items-center justify-between px-3 py-2 bg-dark-800/50 rounded-lg"
                  data-testid="port-item"
                >
                  <span className="text-sm font-mono text-white">{port}</span>
                  <span className="text-xs text-slate-400">
                    {services[port] || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technologies */}
        {technologies.length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="technologies-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary-400" />
              Detected Technologies
            </h3>
            <div className="flex flex-wrap gap-2" data-testid="technologies-list">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm text-purple-300"
                  data-testid="technology-item"
                >
                  {tech}
                </span>
              ))}
            </div>
            {profile.cmsType && (
              <div className="mt-3 pt-3 border-t border-dark-700">
                <span className="text-xs text-slate-500">CMS: </span>
                <span className="text-sm text-white" data-testid="cms-type">{profile.cmsType}</span>
              </div>
            )}
            {profile.cloudProvider && (
              <div className="mt-2">
                <span className="text-xs text-slate-500">Cloud: </span>
                <span className="text-sm text-white" data-testid="cloud-provider">{profile.cloudProvider}</span>
              </div>
            )}
          </div>
        )}

        {/* Security Headers */}
        {Object.keys(securityHeaders).length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="security-headers-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-400" />
              Security Headers
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(securityHeaders).map(([header, value]) => (
                <div
                  key={header}
                  className="px-3 py-2 bg-dark-800/50 rounded-lg"
                  data-testid="security-header-item"
                >
                  <div className="text-xs text-slate-400">{header}</div>
                  <div className="text-sm text-white truncate" title={value}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SSL Info */}
        {sslInfo && Object.keys(sslInfo).length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="ssl-info-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary-400" />
              SSL/TLS Information
            </h3>
            <div className="space-y-2">
              {sslInfo.issuer && (
                <div className="px-3 py-2 bg-dark-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">Issuer</div>
                  <div className="text-sm text-white">{sslInfo.issuer}</div>
                </div>
              )}
              {sslInfo.validFrom && (
                <div className="px-3 py-2 bg-dark-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">Valid From</div>
                  <div className="text-sm text-white">{sslInfo.validFrom}</div>
                </div>
              )}
              {sslInfo.validTo && (
                <div className="px-3 py-2 bg-dark-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">Valid To</div>
                  <div className="text-sm text-white">{sslInfo.validTo}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subdomains */}
        {subdomains.length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="subdomains-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Network className="w-4 h-4 text-primary-400" />
              Discovered Subdomains ({subdomains.length})
            </h3>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {subdomains.slice(0, 20).map((subdomain) => (
                <span
                  key={subdomain}
                  className="px-2 py-1 bg-dark-800 rounded text-xs text-slate-300 font-mono"
                  data-testid="subdomain-item"
                >
                  {subdomain}
                </span>
              ))}
              {subdomains.length > 20 && (
                <span className="px-2 py-1 bg-dark-700 rounded text-xs text-slate-400">
                  +{subdomains.length - 20} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Endpoints */}
        {endpoints.length > 0 && (
          <div className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="endpoints-section">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Code className="w-4 h-4 text-primary-400" />
              Discovered Endpoints ({endpoints.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {endpoints.slice(0, 10).map((endpoint) => (
                <div
                  key={endpoint}
                  className="px-2 py-1.5 bg-dark-800/50 rounded text-xs text-slate-300 font-mono truncate"
                  title={endpoint}
                  data-testid="endpoint-item"
                >
                  {endpoint}
                </div>
              ))}
              {endpoints.length > 10 && (
                <div className="px-2 py-1 text-xs text-slate-400">
                  +{endpoints.length - 10} more endpoints
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recommended Tools */}
      {recommendedTools.length > 0 && (
        <div className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800" data-testid="recommended-tools-section">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-400" />
            Recommended Security Tools
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Based on the target profile, these tools are recommended for further analysis:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="recommended-tools-list">
            {recommendedTools.map((tool) => (
              <Link
                key={tool}
                href={`/dashboard/hexstrike/tools/${tool}`}
                className="flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-all group"
                data-testid="recommended-tool-item"
              >
                <span className="text-sm text-white group-hover:text-primary-400 transition-colors">
                  {tool}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-primary-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-sm text-slate-400">
            Analysis completed for <span className="text-white font-medium">{profile.target}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/hexstrike/tools"
              className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              <Wrench className="w-4 h-4" />
              Browse Tools
            </Link>
            <Link
              href="/dashboard/hexstrike/workflows"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Start Workflow
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default TargetProfileDisplay;
