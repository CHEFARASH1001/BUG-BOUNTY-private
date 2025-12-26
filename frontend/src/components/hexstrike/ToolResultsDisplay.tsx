'use client';

import { CheckCircle, AlertCircle, Clock, Loader2, XCircle, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Vulnerability {
  name?: string;
  title?: string;
  severity?: VulnerabilitySeverity;
  description?: string;
  evidence?: string;
  remediation?: string;
  cvss?: number;
  cve?: string;
}

export interface ToolExecution {
  id: string;
  tool: string;
  target: string;
  status: ExecutionStatus;
  startTime?: string;
  endTime?: string;
  output?: string;
  results?: any;
  error?: string;
  pid?: number;
}

export interface SeverityColorConfig {
  bg: string;
  text: string;
  border: string;
}

export interface StatusConfig {
  icon: typeof CheckCircle;
  color: string;
  bg: string;
}

// ============================================================================
// HELPER FUNCTIONS (Exported for testing)
// ============================================================================

/**
 * Get color configuration for a vulnerability severity level
 * Consistent with design document Property 6: Severity Color Mapping Consistency
 * 
 * @param severity - The vulnerability severity level
 * @returns Color configuration object with bg, text, and border classes
 */
export const getSeverityColors = (severity: VulnerabilitySeverity | string): SeverityColorConfig => {
  const normalizedSeverity = severity?.toLowerCase() || 'info';
  
  switch (normalizedSeverity) {
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    case 'high':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'medium':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
    case 'low':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
    case 'info':
    default:
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
  }
};

/**
 * Get status configuration for an execution status
 * 
 * @param status - The execution status
 * @returns Status configuration object with icon, color, and bg classes
 */
export const getStatusConfig = (status: ExecutionStatus): StatusConfig => {
  switch (status) {
    case 'pending':
      return { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20' };
    case 'running':
      return { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    case 'completed':
      return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' };
    case 'failed':
      return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' };
    case 'cancelled':
      return { icon: StopCircle, color: 'text-orange-400', bg: 'bg-orange-500/20' };
    default:
      return { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20' };
  }
};

/**
 * Check if an object is a vulnerability (has severity or vulnerability-related fields)
 * 
 * @param item - The item to check
 * @returns True if the item appears to be a vulnerability
 */
export const isVulnerability = (item: any): item is Vulnerability => {
  if (!item || typeof item !== 'object') return false;
  return (
    'severity' in item ||
    'vulnerability' in item ||
    'vuln' in item ||
    ('name' in item && ('cvss' in item || 'cve' in item || 'remediation' in item))
  );
};

/**
 * Extract vulnerabilities from results
 * Handles various result formats (array, object with vulnerabilities field, etc.)
 * 
 * @param results - The results to extract vulnerabilities from
 * @returns Array of vulnerabilities
 */
export const extractVulnerabilities = (results: any): Vulnerability[] => {
  if (!results) return [];
  
  // Handle array of results
  if (Array.isArray(results)) {
    return results.filter(isVulnerability);
  }
  
  // Handle object with vulnerabilities array
  if (typeof results === 'object' && results.vulnerabilities && Array.isArray(results.vulnerabilities)) {
    return results.vulnerabilities.filter(isVulnerability);
  }
  
  // Handle single vulnerability object
  if (isVulnerability(results)) {
    return [results];
  }
  
  return [];
};

/**
 * Get the display name for a vulnerability
 * 
 * @param vuln - The vulnerability object
 * @returns The display name
 */
export const getVulnerabilityName = (vuln: Vulnerability): string => {
  return vuln.name || vuln.title || 'Vulnerability';
};

/**
 * Check if results contain any vulnerabilities
 * 
 * @param results - The results to check
 * @returns True if results contain vulnerabilities
 */
export const hasVulnerabilities = (results: any): boolean => {
  return extractVulnerabilities(results).length > 0;
};

/**
 * Count vulnerabilities by severity
 * 
 * @param vulnerabilities - Array of vulnerabilities
 * @returns Object with counts per severity level
 */
export const countBySeverity = (vulnerabilities: Vulnerability[]): Record<VulnerabilitySeverity, number> => {
  const counts: Record<VulnerabilitySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  
  vulnerabilities.forEach(vuln => {
    const severity = (vuln.severity?.toLowerCase() || 'info') as VulnerabilitySeverity;
    if (severity in counts) {
      counts[severity]++;
    } else {
      counts.info++;
    }
  });
  
  return counts;
};

/**
 * Format results for display
 * Converts various result types to a displayable string
 * 
 * @param results - The results to format
 * @returns Formatted string representation
 */
export const formatResults = (results: any): string => {
  if (!results) return '';
  if (typeof results === 'string') return results;
  return JSON.stringify(results, null, 2);
};

/**
 * Check if execution is in a terminal state
 * 
 * @param status - The execution status
 * @returns True if execution is complete (success, failure, or cancelled)
 */
export const isTerminalStatus = (status: ExecutionStatus): boolean => {
  return ['completed', 'failed', 'cancelled'].includes(status);
};

/**
 * Check if execution is in progress
 * 
 * @param status - The execution status
 * @returns True if execution is running or pending
 */
export const isInProgress = (status: ExecutionStatus): boolean => {
  return ['pending', 'running'].includes(status);
};

// ============================================================================
// COMPONENT
// ============================================================================

interface VulnerabilityCardProps {
  vulnerability: Vulnerability;
  index: number;
}

/**
 * VulnerabilityCard Component
 * Renders a single vulnerability with severity highlighting
 */
export function VulnerabilityCard({ vulnerability, index }: VulnerabilityCardProps) {
  const severity = vulnerability.severity?.toLowerCase() || 'info';
  const colors = getSeverityColors(severity);

  return (
    <div
      data-testid={`vulnerability-card-${index}`}
      className={cn('p-4 rounded-lg border', colors.bg, colors.border)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-white" data-testid="vulnerability-name">
          {getVulnerabilityName(vulnerability)}
        </h4>
        <span 
          className={cn('px-2 py-0.5 rounded text-xs font-medium uppercase', colors.bg, colors.text)}
          data-testid="vulnerability-severity"
        >
          {severity}
        </span>
      </div>
      {vulnerability.description && (
        <p className="text-sm text-slate-400 mb-2" data-testid="vulnerability-description">
          {vulnerability.description}
        </p>
      )}
      {vulnerability.evidence && (
        <div 
          className="mt-2 p-2 bg-dark-900/50 rounded text-xs font-mono text-slate-300 overflow-x-auto"
          data-testid="vulnerability-evidence"
        >
          {vulnerability.evidence}
        </div>
      )}
      {vulnerability.remediation && (
        <div className="mt-2 text-sm text-slate-400" data-testid="vulnerability-remediation">
          <span className="text-slate-500">Remediation:</span> {vulnerability.remediation}
        </div>
      )}
      {vulnerability.cvss !== undefined && (
        <div className="mt-2 text-sm text-slate-400" data-testid="vulnerability-cvss">
          <span className="text-slate-500">CVSS:</span> {vulnerability.cvss}
        </div>
      )}
      {vulnerability.cve && (
        <div className="mt-1 text-sm text-slate-400" data-testid="vulnerability-cve">
          <span className="text-slate-500">CVE:</span> {vulnerability.cve}
        </div>
      )}
    </div>
  );
}

interface ToolResultsDisplayProps {
  results: any;
  showEmptyState?: boolean;
}

/**
 * ToolResultsDisplay Component
 * 
 * Renders tool execution results with vulnerability highlighting
 * 
 * **Feature: hexstrike-ai-integration, Property 5: Tool Results UI Rendering**
 * 
 * *For any* completed tool execution with results, the Frontend_UI shall render
 * the results in a structured format appropriate to the tool type, with all
 * output data accessible to the user.
 * 
 * **Validates: Requirements 4.4**
 */
export function ToolResultsDisplay({ results, showEmptyState = true }: ToolResultsDisplayProps) {
  if (!results) {
    return showEmptyState ? (
      <div className="text-center py-8 text-slate-400" data-testid="no-results">
        <p>No results to display</p>
      </div>
    ) : null;
  }

  // Extract vulnerabilities from results
  const vulnerabilities = extractVulnerabilities(results);

  // If we have vulnerabilities, render them
  if (vulnerabilities.length > 0) {
    return (
      <div className="space-y-3" data-testid="vulnerabilities-list">
        {vulnerabilities.map((vuln, index) => (
          <VulnerabilityCard key={index} vulnerability={vuln} index={index} />
        ))}
      </div>
    );
  }

  // Handle array of non-vulnerability results
  if (Array.isArray(results)) {
    if (results.length === 0) {
      return showEmptyState ? (
        <div className="text-center py-8 text-slate-400" data-testid="empty-results">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>No vulnerabilities found</p>
        </div>
      ) : null;
    }
    return (
      <div className="space-y-3" data-testid="results-list">
        {results.map((item, index) => (
          <div 
            key={index} 
            className="p-3 bg-dark-800/50 rounded-lg text-sm text-slate-300"
            data-testid={`result-item-${index}`}
          >
            {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
          </div>
        ))}
      </div>
    );
  }

  // Handle object results (render as JSON)
  if (typeof results === 'object') {
    return (
      <pre 
        className="p-4 bg-dark-800/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap"
        data-testid="json-results"
      >
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  }

  // Handle string results
  return (
    <pre 
      className="p-4 bg-dark-800/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap"
      data-testid="string-results"
    >
      {results}
    </pre>
  );
}

export default ToolResultsDisplay;
