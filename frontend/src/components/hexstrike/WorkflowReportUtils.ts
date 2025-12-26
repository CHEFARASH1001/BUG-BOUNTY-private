/**
 * Workflow Report Utilities
 * 
 * Utility functions for generating and validating workflow reports.
 * These functions are extracted for testability with property-based testing.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type WorkflowType = 'bugbounty' | 'ctf' | 'reconnaissance' | 'vulnerability-hunting' | 'osint';
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  name: string;
  severity: SeverityLevel;
  description: string;
  tool: string;
  evidence?: string;
  remediation?: string;
}

export interface WorkflowExecution {
  id: string;
  type: WorkflowType;
  target: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  startTime: string;
  endTime?: string;
  findings: Finding[];
}

export interface WorkflowReport {
  workflowType: string;
  target: string;
  executionDuration: number;
  stepsCompleted: number;
  totalSteps: number;
  findings: Finding[];
  recommendations: string[];
  summary: string;
}


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate execution duration in seconds from start and end times
 */
export function calculateDuration(startTime: string, endTime?: string): number {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Generate recommendations based on findings
 */
export function generateRecommendations(findings: Finding[]): string[] {
  const recommendations: string[] = [];
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  findings.forEach(finding => {
    severityCounts[finding.severity]++;
    if (finding.remediation && !recommendations.includes(finding.remediation)) {
      recommendations.push(finding.remediation);
    }
  });

  // Add general recommendations based on severity distribution
  if (severityCounts.critical > 0) {
    recommendations.push('Address critical vulnerabilities immediately');
  }
  if (severityCounts.high > 0) {
    recommendations.push('Prioritize high severity findings for remediation');
  }
  if (severityCounts.medium > 0) {
    recommendations.push('Review and address medium severity issues');
  }
  if (findings.length === 0) {
    recommendations.push('Continue regular security assessments');
  }

  return recommendations;
}

/**
 * Generate summary text for the workflow report
 */
export function generateSummary(
  workflowType: string,
  target: string,
  stepsCompleted: number,
  totalSteps: number,
  findings: Finding[]
): string {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => severityCounts[f.severity]++);

  const criticalHighCount = severityCounts.critical + severityCounts.high;
  const completionRate = totalSteps > 0 ? Math.round((stepsCompleted / totalSteps) * 100) : 0;

  let summary = `Completed ${workflowType} workflow on ${target}. `;
  summary += `${stepsCompleted}/${totalSteps} steps completed (${completionRate}%). `;
  summary += `Found ${findings.length} finding${findings.length !== 1 ? 's' : ''}`;

  if (criticalHighCount > 0) {
    summary += ` including ${criticalHighCount} critical/high severity issue${criticalHighCount !== 1 ? 's' : ''}`;
  }
  summary += '.';

  return summary;
}


/**
 * Generate a complete workflow report from execution data
 * 
 * **Validates: Requirements 5.5**
 * 
 * For any completed AI_Agent workflow, the report shall contain:
 * - workflow type
 * - execution duration
 * - steps completed
 * - findings discovered
 * - recommendations
 */
export function generateWorkflowReport(execution: WorkflowExecution): WorkflowReport | null {
  // Only generate report for completed workflows
  if (execution.status !== 'completed') {
    return null;
  }

  const executionDuration = calculateDuration(execution.startTime, execution.endTime);
  const recommendations = generateRecommendations(execution.findings);
  const summary = generateSummary(
    execution.type,
    execution.target,
    execution.currentStep,
    execution.totalSteps,
    execution.findings
  );

  return {
    workflowType: execution.type,
    target: execution.target,
    executionDuration,
    stepsCompleted: execution.currentStep,
    totalSteps: execution.totalSteps,
    findings: execution.findings,
    recommendations,
    summary,
  };
}

/**
 * Validate that a workflow report contains all required fields
 */
export function validateWorkflowReport(report: WorkflowReport): boolean {
  // Check required string fields
  if (!report.workflowType || typeof report.workflowType !== 'string') return false;
  if (!report.target || typeof report.target !== 'string') return false;
  if (!report.summary || typeof report.summary !== 'string') return false;

  // Check required number fields
  if (typeof report.executionDuration !== 'number' || report.executionDuration < 0) return false;
  if (typeof report.stepsCompleted !== 'number' || report.stepsCompleted < 0) return false;
  if (typeof report.totalSteps !== 'number' || report.totalSteps < 0) return false;

  // Check required array fields
  if (!Array.isArray(report.findings)) return false;
  if (!Array.isArray(report.recommendations)) return false;

  // Validate steps relationship
  if (report.stepsCompleted > report.totalSteps) return false;

  return true;
}

/**
 * Get severity color mapping for findings display
 */
export function getSeverityColor(severity: SeverityLevel): { bg: string; text: string; border: string } {
  const colors: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    info: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  };
  return colors[severity] || colors.info;
}

/**
 * Count findings by severity
 */
export function countFindingsBySeverity(findings: Finding[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  findings.forEach(finding => {
    if (counts[finding.severity] !== undefined) {
      counts[finding.severity]++;
    }
  });

  return counts;
}
