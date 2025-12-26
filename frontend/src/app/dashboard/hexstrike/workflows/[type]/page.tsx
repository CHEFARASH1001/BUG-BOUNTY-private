'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowLeft,
  Play,
  Pause,
  StopCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Target,
  Settings,
  Clock,
  Terminal,
  ChevronDown,
  ChevronRight,
  FileText,
  Download,
  Search,
  Shield,
  Eye,
  Flag,
  Bug,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';


// Workflow type based on backend interfaces
type WorkflowType = 'bugbounty' | 'ctf' | 'reconnaissance' | 'vulnerability-hunting' | 'osint';

// Workflow status
type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

// Step status
type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Workflow step interface
interface WorkflowStep {
  id: string;
  tool: string;
  displayName: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
  output?: string;
  results?: any;
  error?: string;
}

// AI Workflow interface
interface AIWorkflow {
  type: WorkflowType;
  name: string;
  description: string;
  steps: any[];
  estimatedTime: number;
  requiredTools: string[];
}

// Workflow execution interface
interface WorkflowExecution {
  id: string;
  type: WorkflowType;
  target: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStep[];
  startTime: string;
  endTime?: string;
  findings: any[];
  report?: WorkflowReport;
  error?: string;
  pid?: number;
}

// Workflow report interface
interface WorkflowReport {
  workflowType: string;
  target: string;
  executionDuration: number;
  stepsCompleted: number;
  totalSteps: number;
  findings: Finding[];
  recommendations: string[];
  summary: string;
}

// Finding interface
interface Finding {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  tool: string;
  evidence?: string;
  remediation?: string;
}


// Workflow type configuration
const workflowConfig: Record<WorkflowType, { 
  label: string; 
  icon: typeof Zap; 
  color: string; 
  bg: string;
}> = {
  reconnaissance: { label: 'Reconnaissance', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'vulnerability-hunting': { label: 'Vulnerability Hunting', icon: Bug, color: 'text-red-400', bg: 'bg-red-500/20' },
  bugbounty: { label: 'Bug Bounty', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/20' },
  osint: { label: 'OSINT', icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  ctf: { label: 'CTF', icon: Flag, color: 'text-orange-400', bg: 'bg-orange-500/20' },
};

// Status configuration
const statusConfig: Record<WorkflowStatus | StepStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  paused: { icon: Pause, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  cancelled: { icon: StopCircle, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  skipped: { icon: ChevronRight, color: 'text-slate-500', bg: 'bg-slate-500/20' },
};

// Severity colors
const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  info: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};


export default function WorkflowExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const workflowType = params.type as WorkflowType;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [workflow, setWorkflow] = useState<AIWorkflow | null>(null);
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'progress' | 'logs' | 'report'>('progress');
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Form state
  const [target, setTarget] = useState('');
  const [options, setOptions] = useState<Record<string, any>>({
    depth: 'standard',
    threads: 10,
    timeout: 300,
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set());
  const [toolResults, setToolResults] = useState<Record<string, any>>({});

  // Execute a specific tool
  const handleRunTool = async (toolName: string) => {
    if (!target.trim()) return;
    
    setRunningTools((prev) => new Set(prev).add(toolName));
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🔧 Running ${toolName} on ${target}...`]);
    setActiveTab('logs');

    try {
      const response = await hexstrikeApi.executeTool(toolName, {
        target: target.trim(),
        parameters: { url: target.trim(), domain: target.trim() },
      });

      const result = response.data;
      setToolResults((prev) => ({ ...prev, [toolName]: result }));
      
      // HexStrike AI returns stdout/stderr, not output
      const output = result.stdout || result.output || '';
      const errorOutput = result.stderr || '';
      
      if (output) {
        const outputLines = output.split('\n').slice(0, 20); // First 20 lines
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ ${toolName} completed`,
          ...outputLines.map((line: string) => `   ${line}`),
          outputLines.length < output.split('\n').length 
            ? `   ... (${output.split('\n').length - 20} more lines)` 
            : '',
        ].filter(Boolean));
      } else if (result.error || errorOutput) {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${toolName}: ${result.error || errorOutput}`]);
      } else {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ ${toolName} completed (no output)`]);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${toolName} failed: ${errorMsg}`]);
    } finally {
      setRunningTools((prev) => {
        const newSet = new Set(prev);
        newSet.delete(toolName);
        return newSet;
      });
    }
  };

  // Fetch workflow details
  const fetchWorkflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hexstrikeApi.getWorkflows();
      const workflows = Array.isArray(response.data) ? response.data : [];
      const found = workflows.find((w: AIWorkflow) => w.type === workflowType);
      if (found) {
        setWorkflow(found);
      } else {
        setError(`Workflow "${workflowType}" not found`);
      }
    } catch (err) {
      console.error('Failed to fetch workflow:', err);
      setError('Failed to load workflow details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [workflowType]);

  useEffect(() => {
    fetchWorkflow();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchWorkflow]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current && activeTab === 'logs') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);


  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!target.trim()) {
      errors.target = 'Target is required';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Poll for execution status
  const pollExecutionStatus = useCallback(async (pid: number) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await hexstrikeApi.getProcessStatus(pid);
        const process = response.data;

        // Add logs from process output
        if (process.process?.last_output) {
          setLogs((prev) => {
            const newLog = `[${new Date().toLocaleTimeString()}] ${process.process.last_output}`;
            if (prev[prev.length - 1] !== newLog) {
              return [...prev, newLog];
            }
            return prev;
          });
        }

        // Add progress info to logs
        if (process.process?.progress !== undefined) {
          const progressPercent = (process.process.progress * 100).toFixed(1);
          setLogs((prev) => {
            const progressLog = `[${new Date().toLocaleTimeString()}] Progress: ${progressPercent}% | Runtime: ${process.process.runtime_formatted || 'N/A'}`;
            // Only add if different from last log
            if (!prev[prev.length - 1]?.includes('Progress:')) {
              return [...prev, progressLog];
            }
            // Update last progress log
            const newLogs = [...prev];
            const lastProgressIdx = newLogs.findLastIndex(l => l.includes('Progress:'));
            if (lastProgressIdx >= 0) {
              newLogs[lastProgressIdx] = progressLog;
            }
            return newLogs;
          });
        }

        setExecution((prev) => {
          if (!prev) return prev;
          
          const newStatus: WorkflowStatus = 
            process.process?.status === 'terminated' ? 'cancelled' :
            process.process?.status === 'completed' ? 'completed' :
            process.process?.status === 'failed' ? 'failed' : 
            process.process?.status === 'running' ? 'running' : prev.status;

          // Generate mock steps progress for visualization
          const totalSteps = prev.totalSteps || 5;
          let currentStep = prev.currentStep;
          
          if (newStatus === 'running' && currentStep < totalSteps) {
            currentStep = Math.min(currentStep + 1, totalSteps);
          } else if (newStatus === 'completed') {
            currentStep = totalSteps;
          }

          const updatedSteps = prev.steps.map((step, idx) => ({
            ...step,
            status: idx < currentStep ? 'completed' as StepStatus :
                   idx === currentStep && newStatus === 'running' ? 'running' as StepStatus :
                   newStatus === 'failed' && idx === currentStep ? 'failed' as StepStatus :
                   'pending' as StepStatus,
            output: process.process?.last_output || step.output,
          }));

          return {
            ...prev,
            status: newStatus,
            currentStep,
            steps: updatedSteps,
            endTime: ['completed', 'failed', 'cancelled'].includes(newStatus) 
              ? new Date().toISOString() 
              : prev.endTime,
          };
        });

        if (['completed', 'failed', 'terminated'].includes(process.process?.status)) {
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Workflow ${process.process?.status}`]);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          // Switch to report tab on completion
          if (process.process?.status === 'completed') {
            setActiveTab('report');
          }
        }
      } catch (err) {
        console.error('Failed to poll execution status:', err);
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Failed to fetch status`]);
      }
    }, 2000); // Poll every 2 seconds for more responsive logs
  }, []);


  // Execute tools from assessment and capture results
  const executeToolsFromAssessment = async (assessment: any, targetDomain: string) => {
    // Collect all unique tools from the assessment
    const toolsToRun: { tool: string; priority: number }[] = [];
    
    // Get tools from vulnerability tests (highest priority)
    if (assessment.vulnerability_hunting?.vulnerability_tests) {
      assessment.vulnerability_hunting.vulnerability_tests.forEach((test: any) => {
        if (test.tools) {
          test.tools.forEach((tool: string) => {
            if (!toolsToRun.find(t => t.tool === tool)) {
              toolsToRun.push({ tool, priority: test.priority || 5 });
            }
          });
        }
      });
    }

    // Sort by priority (highest first)
    toolsToRun.sort((a, b) => b.priority - a.priority);

    // Limit to top tools to avoid overwhelming
    const toolsToExecute = toolsToRun.slice(0, 5);

    if (toolsToExecute.length === 0) {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ No tools to execute from assessment`]);
      return;
    }

    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🔧 Executing ${toolsToExecute.length} priority tools...`]);

    // Execute each tool sequentially
    for (const { tool } of toolsToExecute) {
      setRunningTools((prev) => new Set(prev).add(tool));
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🔧 Running ${tool} on ${targetDomain}...`]);

      // Update execution step status
      setExecution((prev) => {
        if (!prev) return prev;
        const stepIdx = prev.steps.findIndex(s => s.tool === tool);
        if (stepIdx >= 0) {
          const updatedSteps = [...prev.steps];
          updatedSteps[stepIdx] = { ...updatedSteps[stepIdx], status: 'running' as StepStatus };
          return { ...prev, steps: updatedSteps, currentStep: stepIdx };
        }
        return prev;
      });

      try {
        const response = await hexstrikeApi.executeTool(tool, {
          target: targetDomain,
          parameters: { url: targetDomain, domain: targetDomain },
        });

        const result = response.data;
        setToolResults((prev) => ({ ...prev, [tool]: result }));

        // Update execution step with results
        setExecution((prev) => {
          if (!prev) return prev;
          const stepIdx = prev.steps.findIndex(s => s.tool === tool);
          if (stepIdx >= 0) {
            const updatedSteps = [...prev.steps];
            updatedSteps[stepIdx] = { 
              ...updatedSteps[stepIdx], 
              status: 'completed' as StepStatus,
              output: result.stdout || result.output || result.error || 'Completed',
              results: result
            };
            return { ...prev, steps: updatedSteps };
          }
          return prev;
        });

        // HexStrike AI returns stdout/stderr, not output
        const output = result.stdout || result.output || '';
        const errorOutput = result.stderr || '';
        
        if (output) {
          const outputLines = output.split('\n').filter((l: string) => l.trim()).slice(0, 10);
          setLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] ✅ ${tool} completed`,
            ...outputLines.map((line: string) => `   ${line}`),
            outputLines.length < output.split('\n').filter((l: string) => l.trim()).length
              ? `   ... (${output.split('\n').filter((l: string) => l.trim()).length - 10} more lines)`
              : '',
          ].filter(Boolean));
        } else if (result.error || errorOutput) {
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ ${tool}: ${result.error || errorOutput}`]);
        } else {
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ ${tool} completed (no output)`]);
        }
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${tool} failed: ${errorMsg}`]);
        
        // Update step as failed
        setExecution((prev) => {
          if (!prev) return prev;
          const stepIdx = prev.steps.findIndex(s => s.tool === tool);
          if (stepIdx >= 0) {
            const updatedSteps = [...prev.steps];
            updatedSteps[stepIdx] = { 
              ...updatedSteps[stepIdx], 
              status: 'failed' as StepStatus,
              error: errorMsg
            };
            return { ...prev, steps: updatedSteps };
          }
          return prev;
        });
      } finally {
        setRunningTools((prev) => {
          const newSet = new Set(prev);
          newSet.delete(tool);
          return newSet;
        });
      }
    }

    // Mark execution as completed
    setExecution((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'completed',
        endTime: new Date().toISOString(),
        currentStep: prev.totalSteps
      };
    });

    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ All tools completed`]);
  };

  // Start workflow execution
  const handleStart = async () => {
    if (!validateForm()) return;

    setExecuting(true);
    setError(null);
    setExecution(null);
    setToolResults({});
    setLogs([`[${new Date().toLocaleTimeString()}] 🚀 Starting ${workflowType} workflow for target: ${target.trim()}`]);
    setActiveTab('logs'); // Switch to logs tab when starting

    try {
      const response = await hexstrikeApi.startWorkflow(workflowType, {
        target: target.trim(),
        options,
      });

      // Log the assessment results
      const assessment = response.data.assessment || response.data;
      setAssessmentData(assessment);
      
      // Collect tools from assessment for steps
      const toolsFromAssessment: string[] = [];
      if (assessment.vulnerability_hunting?.vulnerability_tests) {
        assessment.vulnerability_hunting.vulnerability_tests.forEach((test: any) => {
          if (test.tools) {
            test.tools.forEach((tool: string) => {
              if (!toolsFromAssessment.includes(tool)) {
                toolsFromAssessment.push(tool);
              }
            });
          }
        });
      }
      
      // Use assessment tools or fallback to workflow required tools
      const toolsToUse = toolsFromAssessment.length > 0 
        ? toolsFromAssessment.slice(0, 5) 
        : (workflow?.requiredTools || ['nmap', 'nuclei', 'ffuf']);

      // Initialize execution state with real steps
      const steps: WorkflowStep[] = toolsToUse.map((tool, idx) => ({
        id: `step-${idx}`,
        tool,
        displayName: tool.charAt(0).toUpperCase() + tool.slice(1),
        status: 'pending' as StepStatus,
      }));

      const newExecution: WorkflowExecution = {
        id: response.data.id || `exec-${Date.now()}`,
        type: workflowType,
        target: target.trim(),
        status: 'running',
        currentStep: 0,
        totalSteps: steps.length,
        steps,
        startTime: new Date().toISOString(),
        findings: [],
        pid: response.data.pid,
      };

      setExecution(newExecution);
      
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ Assessment completed for ${target.trim()}`,
        `[${new Date().toLocaleTimeString()}] 📊 Summary:`,
        `   - Total tools: ${assessment.summary?.total_tools || 'N/A'}`,
        `   - Workflow count: ${assessment.summary?.workflow_count || 'N/A'}`,
        `   - Priority score: ${assessment.summary?.priority_score || 'N/A'}`,
        `   - Estimated time: ${Math.round((assessment.summary?.total_estimated_time || 0) / 60)} minutes`,
        `[${new Date().toLocaleTimeString()}] 🔍 Reconnaissance phases: ${assessment.reconnaissance?.phases?.length || 0}`,
        `[${new Date().toLocaleTimeString()}] 🐛 Vulnerability tests: ${assessment.vulnerability_hunting?.vulnerability_tests?.length || 0}`,
        `[${new Date().toLocaleTimeString()}] 🕵️ OSINT phases: ${assessment.osint?.osint_phases?.length || 0}`,
        `[${new Date().toLocaleTimeString()}] 💼 Business logic tests: ${assessment.business_logic?.business_logic_tests?.length || 0}`,
      ]);
      
      // Log detailed vulnerability tests
      if (assessment.vulnerability_hunting?.vulnerability_tests) {
        assessment.vulnerability_hunting.vulnerability_tests.forEach((test: any) => {
          setLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] 🎯 ${test.vulnerability_type?.toUpperCase()}: Priority ${test.priority}, Tools: ${test.tools?.join(', ') || 'N/A'}`,
          ]);
        });
      }

      // Now execute the tools and capture results
      await executeToolsFromAssessment(assessment, target.trim());

      // Switch to report tab after completion
      setActiveTab('report');
    } catch (err: any) {
      console.error('Workflow start failed:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to start workflow. Please try again.';
      setError(errorMessage);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Error: ${errorMessage}`]);
    } finally {
      setExecuting(false);
    }
  };

  // Pause workflow
  const handlePause = async () => {
    if (!execution) return;
    setExecution((prev) => prev ? { ...prev, status: 'paused' } : null);
  };

  // Resume workflow
  const handleResume = async () => {
    if (!execution) return;
    setExecution((prev) => prev ? { ...prev, status: 'running' } : null);
    if (execution.pid) {
      pollExecutionStatus(execution.pid);
    }
  };

  // Cancel workflow
  const handleCancel = async () => {
    if (!execution?.pid) return;

    try {
      await hexstrikeApi.terminateProcess(execution.pid);
      setExecution((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      setShowCancelConfirm(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
      setError('Failed to cancel workflow. Please try again.');
    }
  };

  // Toggle step expansion
  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  // Format duration
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };


  // Generate report from assessment data and tool results
  const generateReport = (): WorkflowReport | null => {
    if (!execution || execution.status !== 'completed') return null;

    const findings: Finding[] = [];
    const recommendations: string[] = [];

    // Add findings from actual tool results first
    Object.entries(toolResults).forEach(([tool, result]) => {
      if (result.output && result.output.trim()) {
        // Parse output for potential findings
        const output = result.output;
        
        // Check for vulnerability indicators in output
        const vulnPatterns = [
          { pattern: /critical|CRITICAL/gi, severity: 'critical' as const },
          { pattern: /high|HIGH/gi, severity: 'high' as const },
          { pattern: /medium|MEDIUM/gi, severity: 'medium' as const },
          { pattern: /low|LOW/gi, severity: 'low' as const },
          { pattern: /vuln|vulnerability|CVE-/gi, severity: 'medium' as const },
          { pattern: /injection|sqli|xss|rce|ssrf|idor/gi, severity: 'high' as const },
        ];

        let foundSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';
        for (const { pattern, severity } of vulnPatterns) {
          if (pattern.test(output)) {
            foundSeverity = severity;
            break;
          }
        }

        // Extract first meaningful lines as description
        const lines = output.split('\n').filter((l: string) => l.trim()).slice(0, 3);
        const description = lines.join(' ').slice(0, 200) || `${tool} scan completed`;

        findings.push({
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} Scan Results`,
          severity: foundSeverity,
          description,
          tool,
          evidence: output.slice(0, 500),
        });
      } else if (result.error) {
        findings.push({
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} Error`,
          severity: 'info',
          description: result.error,
          tool,
        });
      }
    });

    // Add findings from assessment data if no tool results
    if (findings.length === 0 && assessmentData?.vulnerability_hunting?.vulnerability_tests) {
      assessmentData.vulnerability_hunting.vulnerability_tests.forEach((test: any) => {
        findings.push({
          name: `${test.vulnerability_type?.toUpperCase()} Testing Plan`,
          severity: test.priority >= 9 ? 'critical' : test.priority >= 7 ? 'high' : test.priority >= 5 ? 'medium' : 'low',
          description: `${test.test_scenarios?.length || 0} test scenarios with ${test.tools?.length || 0} tools`,
          tool: test.tools?.join(', ') || 'N/A',
        });
      });
    }

    // Generate recommendations based on results
    if (Object.keys(toolResults).length > 0) {
      recommendations.push('Review the tool outputs for potential vulnerabilities');
      
      const failedTools = execution.steps.filter(s => s.status === 'failed');
      if (failedTools.length > 0) {
        recommendations.push(`Retry failed tools: ${failedTools.map(s => s.tool).join(', ')}`);
      }
    }

    if (assessmentData?.reconnaissance?.phases) {
      recommendations.push(`Run ${assessmentData.reconnaissance.phases.length} reconnaissance phases for comprehensive coverage`);
    }
    if (assessmentData?.osint?.osint_phases) {
      recommendations.push(`Execute ${assessmentData.osint.osint_phases.length} OSINT gathering phases`);
    }
    if (assessmentData?.business_logic?.business_logic_tests) {
      recommendations.push(`Perform ${assessmentData.business_logic.business_logic_tests.length} business logic test categories`);
    }

    const toolsExecuted = Object.keys(toolResults).length;
    const toolsWithOutput = Object.values(toolResults).filter((r: any) => r.output?.trim()).length;

    return {
      workflowType: execution.type,
      target: execution.target,
      executionDuration: execution.startTime && execution.endTime
        ? Math.floor((new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()) / 1000)
        : 0,
      stepsCompleted: execution.steps.filter(s => s.status === 'completed').length,
      totalSteps: execution.totalSteps,
      findings,
      recommendations,
      summary: toolsExecuted > 0 
        ? `Executed ${toolsExecuted} tools on ${execution.target}. ${toolsWithOutput} tools returned output. ${findings.length} findings identified.`
        : `Assessment completed for ${execution.target}. Identified ${findings.length} vulnerability categories to test with ${assessmentData?.summary?.total_tools || 0} tools.`,
    };
  };

  // Render finding card
  const renderFinding = (finding: Finding, index: number) => {
    const colors = severityColors[finding.severity] || severityColors.info;
    const tools = finding.tool.split(', ').filter(t => t && t !== 'N/A');
    const hasEvidence = finding.evidence && finding.evidence.trim();
    
    return (
      <div key={index} className={cn('p-4 rounded-lg border', colors.bg, colors.border)}>
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-white">{finding.name}</h4>
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium uppercase', colors.bg, colors.text)}>
            {finding.severity}
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-2">{finding.description}</p>
        
        {/* Show evidence/output if available */}
        {hasEvidence && (
          <div className="mt-3 p-2 bg-dark-900/50 rounded text-xs">
            <div className="text-green-400 mb-1">📋 Tool Output:</div>
            <pre className="text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
              {finding.evidence}
              {finding.evidence && finding.evidence.length >= 500 && '...'}
            </pre>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Wrench className="w-3.5 h-3.5" />
            <span>Tool: {finding.tool}</span>
          </div>
          {tools.length > 0 && !hasEvidence && (
            <div className="flex gap-1">
              {tools.slice(0, 2).map((tool) => (
                <button
                  key={tool}
                  onClick={() => handleRunTool(tool)}
                  disabled={runningTools.has(tool)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    runningTools.has(tool)
                      ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                      : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                  )}
                >
                  {runningTools.has(tool) ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      Run {tool}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {finding.remediation && (
          <div className="mt-2 p-2 bg-dark-900/50 rounded text-xs text-slate-400">
            <span className="text-slate-500">Remediation:</span> {finding.remediation}
          </div>
        )}
      </div>
    );
  };

  const config = workflowConfig[workflowType] || workflowConfig.reconnaissance;
  const IconComponent = config.icon;
  const report = generateReport();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  // Workflow not found
  if (!workflow) {
    return (
      <div className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-white mb-2">Workflow Not Found</h2>
        <p className="text-slate-400 mb-4">{error || `The workflow "${workflowType}" could not be found.`}</p>
        <Link
          href="/dashboard/hexstrike/workflows"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hexstrike/workflows"
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className={cn('p-3 rounded-lg', config.bg)}>
              <IconComponent className={cn('w-6 h-6', config.color)} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{workflow.name}</h1>
              <p className="text-slate-400 text-sm">{workflow.description}</p>
            </div>
          </div>
        </div>

        {/* Workflow Controls */}
        {execution && ['running', 'paused'].includes(execution.status) && (
          <div className="flex items-center gap-2">
            {execution.status === 'running' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-sm text-yellow-400 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-sm text-green-400 transition-colors"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-400" />
            Configuration
          </h2>

          <div className="space-y-4">
            {/* Target Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Target className="w-4 h-4 inline mr-1.5" />
                Target <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  if (validationErrors.target) {
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.target;
                      return newErrors;
                    });
                  }
                }}
                placeholder="e.g., example.com, 192.168.1.0/24"
                disabled={execution && ['running', 'paused'].includes(execution.status)}
                className={cn(
                  'w-full px-4 py-2.5 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors disabled:opacity-50',
                  validationErrors.target ? 'border-red-500/50 focus:border-red-500' : 'border-dark-700 focus:border-primary-500/50'
                )}
              />
              {validationErrors.target && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.target}</p>
              )}
            </div>


            {/* Scan Depth */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Scan Depth</label>
              <select
                value={options.depth}
                onChange={(e) => setOptions((prev) => ({ ...prev, depth: e.target.value }))}
                disabled={execution && ['running', 'paused'].includes(execution.status)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors disabled:opacity-50"
              >
                <option value="quick">Quick - Fast surface scan</option>
                <option value="standard">Standard - Balanced coverage</option>
                <option value="deep">Deep - Comprehensive analysis</option>
              </select>
            </div>

            {/* Threads */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Threads</label>
              <input
                type="number"
                value={options.threads}
                onChange={(e) => setOptions((prev) => ({ ...prev, threads: parseInt(e.target.value) || 10 }))}
                min={1}
                max={100}
                disabled={execution && ['running', 'paused'].includes(execution.status)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Required Tools */}
            <div className="pt-4 border-t border-dark-700">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Required Tools</h3>
              <div className="flex flex-wrap gap-2">
                {workflow.requiredTools.map((tool) => (
                  <span key={tool} className="px-2 py-1 bg-dark-800 rounded text-xs text-slate-400">
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-4">
              <button
                onClick={handleStart}
                disabled={executing || (execution && ['running', 'paused'].includes(execution.status))}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  executing || (execution && ['running', 'paused'].includes(execution.status))
                    ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                )}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Workflow
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>


        {/* Progress / Report Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          {/* Tabs */}
          {execution && (
            <div className="flex items-center gap-2 mb-4 border-b border-dark-700 pb-3">
              <button
                onClick={() => setActiveTab('progress')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'progress'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Terminal className="w-4 h-4 inline mr-1.5" />
                Progress
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'logs'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <FileText className="w-4 h-4 inline mr-1.5" />
                Logs
                {execution.status === 'running' && (
                  <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('report')}
                disabled={execution.status !== 'completed'}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'report'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <FileText className="w-4 h-4 inline mr-1.5" />
                Report
              </button>
            </div>
          )}

          {/* No execution yet */}
          {!execution && !error && (
            <div className="text-center py-12 text-slate-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Configure and start the workflow to see progress</p>
            </div>
          )}

          {/* Error display */}
          {error && !execution && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-400 mb-1">Workflow Failed</h4>
                  <p className="text-sm text-slate-400">{error}</p>
                  <button
                    onClick={handleStart}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Progress Tab */}
          {execution && activeTab === 'progress' && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {(() => {
                    const statusCfg = statusConfig[execution.status] || statusConfig.pending;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <>
                        <div className={cn('p-2 rounded-lg', statusCfg.bg)}>
                          <StatusIcon className={cn('w-4 h-4', statusCfg.color, execution.status === 'running' && 'animate-spin')} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white capitalize">{execution.status}</div>
                          <div className="text-xs text-slate-500">
                            Step {execution.currentStep + 1} of {execution.totalSteps}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Duration: {formatDuration(execution.startTime, execution.endTime)}</div>
                  <div>Target: {execution.target}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-dark-800 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((execution.currentStep + 1) / execution.totalSteps) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Attack Chain Visualization */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-400">Attack Chain</h3>
                {execution.steps.map((step, idx) => {
                  const stepStatus = statusConfig[step.status] || statusConfig.pending;
                  const StepIcon = stepStatus.icon;
                  const isExpanded = expandedSteps.has(step.id);

                  return (
                    <div key={step.id} className="relative">
                      {/* Connection line */}
                      {idx < execution.steps.length - 1 && (
                        <div className="absolute left-5 top-10 w-0.5 h-6 bg-dark-700" />
                      )}
                      
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                          step.status === 'running' ? 'bg-blue-500/10 border border-blue-500/30' :
                          step.status === 'completed' ? 'bg-green-500/10 border border-green-500/30' :
                          step.status === 'failed' ? 'bg-red-500/10 border border-red-500/30' :
                          'bg-dark-800/50 border border-dark-700 hover:bg-dark-800'
                        )}
                      >
                        <div className={cn('p-1.5 rounded', stepStatus.bg)}>
                          <StepIcon className={cn('w-4 h-4', stepStatus.color, step.status === 'running' && 'animate-spin')} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{step.displayName}</div>
                          <div className="text-xs text-slate-500">{step.tool}</div>
                        </div>
                        {step.output && (
                          isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      {/* Expanded output */}
                      {isExpanded && step.output && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="ml-10 mt-2 p-3 bg-dark-800/50 rounded-lg"
                        >
                          <pre className="text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
                            {step.output}
                          </pre>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {execution && activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Live Logs
                  {execution.status === 'running' && (
                    <span className="text-xs text-green-400 animate-pulse">● Recording</span>
                  )}
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="bg-dark-950 border border-dark-700 rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    Waiting for logs...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'py-0.5',
                          log.includes('❌') || log.includes('Error') ? 'text-red-400' :
                          log.includes('✅') ? 'text-green-400' :
                          log.includes('⚠️') ? 'text-yellow-400' :
                          log.includes('🚀') ? 'text-blue-400' :
                          log.includes('Progress:') ? 'text-cyan-400' :
                          'text-slate-300'
                        )}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Report Tab */}
          {execution && activeTab === 'report' && report && (
            <div className="space-y-4">
              {/* Report Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Workflow Report</h3>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Summary */}
              <div className="p-4 bg-dark-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Summary</h4>
                <p className="text-sm text-white">{report.summary}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-dark-800/50 rounded-lg text-center">
                  <div className="text-xl font-bold text-white">{report.stepsCompleted}/{report.totalSteps}</div>
                  <div className="text-xs text-slate-500">Steps Completed</div>
                </div>
                <div className="p-3 bg-dark-800/50 rounded-lg text-center">
                  <div className="text-xl font-bold text-white">{report.findings.length}</div>
                  <div className="text-xs text-slate-500">Findings</div>
                </div>
                <div className="p-3 bg-dark-800/50 rounded-lg text-center">
                  <div className="text-xl font-bold text-white">{formatDuration(execution.startTime, execution.endTime)}</div>
                  <div className="text-xs text-slate-500">Duration</div>
                </div>
              </div>

              {/* Findings */}
              {report.findings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Findings</h4>
                  <div className="space-y-2">
                    {report.findings.map((finding, idx) => renderFinding(finding, idx))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Report not available */}
          {execution && activeTab === 'report' && !report && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Report will be available when the workflow completes</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-dark-900 border border-dark-700 rounded-xl max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Cancel Workflow?</h3>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure you want to cancel this workflow? All progress will be lost.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                Keep Running
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white transition-colors"
              >
                Cancel Workflow
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
