'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Wrench,
  ArrowLeft,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Target,
  Settings,
  Clock,
  Terminal,
  StopCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';

// Tool parameter interface
interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

// Security tool interface
interface SecurityTool {
  name: string;
  displayName: string;
  category: string;
  description: string;
  parameters: ToolParameter[];
  effectiveness: Record<string, number>;
  isInstalled: boolean;
}

// Tool execution response
interface ToolExecution {
  id: string;
  tool: string;
  target: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  output?: string;
  results?: any;
  error?: string;
  pid?: number;
}

// Severity color mapping for vulnerability highlighting
const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  info: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};

// Status configuration
const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelled: { icon: StopCircle, color: 'text-orange-400', bg: 'bg-orange-500/20' },
};

export default function ToolExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const toolName = params.tool as string;

  // State
  const [tool, setTool] = useState<SecurityTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<ToolExecution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Form state
  const [target, setTarget] = useState('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch tool details
  const fetchTool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hexstrikeApi.getTools();
      const tools = Array.isArray(response.data) ? response.data : [];
      const foundTool = tools.find((t: SecurityTool) => t.name === toolName);
      if (foundTool) {
        setTool(foundTool);
        // Initialize parameters with defaults
        const defaults: Record<string, any> = {};
        foundTool.parameters?.forEach((param: ToolParameter) => {
          if (param.default !== undefined) {
            defaults[param.name] = param.default;
          }
        });
        setParameters(defaults);
      } else {
        setError(`Tool "${toolName}" not found`);
      }
    } catch (err) {
      console.error('Failed to fetch tool:', err);
      setError('Failed to load tool details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toolName]);

  useEffect(() => {
    fetchTool();
  }, [fetchTool]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!target.trim()) {
      errors.target = 'Target is required';
    }

    // Validate required parameters
    tool?.parameters?.forEach((param) => {
      if (param.required && !parameters[param.name]) {
        errors[param.name] = `${param.name} is required`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Execute tool
  const handleExecute = async () => {
    if (!validateForm()) return;

    setExecuting(true);
    setError(null);
    setExecution(null);

    try {
      const response = await hexstrikeApi.executeTool(toolName, {
        target: target.trim(),
        parameters,
      });
      setExecution(response.data);

      // Poll for status updates if running
      if (response.data.status === 'running' || response.data.status === 'pending') {
        pollExecutionStatus(response.data.pid);
      }
    } catch (err: any) {
      console.error('Tool execution failed:', err);
      const errorMessage = err.response?.data?.message || 'Failed to execute tool. Please try again.';
      setError(errorMessage);
      setExecution({
        id: '',
        tool: toolName,
        target: target.trim(),
        status: 'failed',
        error: errorMessage,
      });
    } finally {
      setExecuting(false);
    }
  };

  // Poll for execution status
  const pollExecutionStatus = async (pid?: number) => {
    if (!pid) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await hexstrikeApi.getProcessStatus(pid);
        const process = response.data;

        setExecution((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: process.status === 'terminated' ? 'cancelled' : 
                   process.status === 'completed' ? 'completed' :
                   process.status === 'failed' ? 'failed' : prev.status,
            output: process.output || prev.output,
            endTime: process.endTime?.toString(),
          };
        });

        // Stop polling if execution is complete
        if (['completed', 'failed', 'terminated'].includes(process.status)) {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll execution status:', err);
        clearInterval(pollInterval);
      }
    }, 2000);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  };

  // Cancel execution
  const handleCancel = async () => {
    if (!execution?.pid) return;

    try {
      await hexstrikeApi.terminateProcess(execution.pid);
      setExecution((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      setShowCancelConfirm(false);
    } catch (err) {
      console.error('Failed to cancel execution:', err);
      setError('Failed to cancel execution. Please try again.');
    }
  };

  // Update parameter value
  const updateParameter = (name: string, value: any) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Render parameter input based on type
  const renderParameterInput = (param: ToolParameter) => {
    const value = parameters[param.name] ?? param.default ?? '';
    const hasError = !!validationErrors[param.name];

    switch (param.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateParameter(param.name, e.target.checked)}
              className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50"
            />
            <span className="text-sm text-slate-300">{param.description}</span>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateParameter(param.name, e.target.value ? Number(e.target.value) : '')}
            placeholder={param.description}
            className={cn(
              'w-full px-4 py-2.5 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors',
              hasError ? 'border-red-500/50 focus:border-red-500' : 'border-dark-700 focus:border-primary-500/50'
            )}
          />
        );

      case 'array':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : value}
            onChange={(e) => updateParameter(param.name, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder={`${param.description} (comma-separated)`}
            className={cn(
              'w-full px-4 py-2.5 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors',
              hasError ? 'border-red-500/50 focus:border-red-500' : 'border-dark-700 focus:border-primary-500/50'
            )}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateParameter(param.name, e.target.value)}
            placeholder={param.description}
            className={cn(
              'w-full px-4 py-2.5 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors',
              hasError ? 'border-red-500/50 focus:border-red-500' : 'border-dark-700 focus:border-primary-500/50'
            )}
          />
        );
    }
  };

  // Render vulnerability with severity highlighting
  const renderVulnerability = (vuln: any, index: number) => {
    const severity = vuln.severity?.toLowerCase() || 'info';
    const colors = severityColors[severity] || severityColors.info;

    return (
      <div
        key={index}
        className={cn('p-4 rounded-lg border', colors.bg, colors.border)}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-white">{vuln.name || vuln.title || 'Vulnerability'}</h4>
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium uppercase', colors.bg, colors.text)}>
            {severity}
          </span>
        </div>
        {vuln.description && (
          <p className="text-sm text-slate-400 mb-2">{vuln.description}</p>
        )}
        {vuln.evidence && (
          <div className="mt-2 p-2 bg-dark-900/50 rounded text-xs font-mono text-slate-300 overflow-x-auto">
            {vuln.evidence}
          </div>
        )}
        {vuln.remediation && (
          <div className="mt-2 text-sm text-slate-400">
            <span className="text-slate-500">Remediation:</span> {vuln.remediation}
          </div>
        )}
      </div>
    );
  };

  // Render results based on type
  const renderResults = (results: any) => {
    if (!results) return null;

    // Handle array of vulnerabilities
    if (Array.isArray(results)) {
      if (results.length === 0) {
        return (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p>No vulnerabilities found</p>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {results.map((item, index) => {
            if (item.severity || item.vulnerability || item.vuln) {
              return renderVulnerability(item, index);
            }
            return (
              <div key={index} className="p-3 bg-dark-800/50 rounded-lg text-sm text-slate-300">
                {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
              </div>
            );
          })}
        </div>
      );
    }

    // Handle object results
    if (typeof results === 'object') {
      // Check for vulnerabilities array in results
      if (results.vulnerabilities && Array.isArray(results.vulnerabilities)) {
        return renderResults(results.vulnerabilities);
      }
      // Render as JSON
      return (
        <pre className="p-4 bg-dark-800/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(results, null, 2)}
        </pre>
      );
    }

    // Handle string results
    return (
      <pre className="p-4 bg-dark-800/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
        {results}
      </pre>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  // Error state - tool not found
  if (!tool) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hexstrike/tools"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Tool Not Found</h1>
        </div>
        <div className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Tool Not Found</h3>
          <p className="text-slate-400 text-sm mb-4">{error || `The tool "${toolName}" could not be found.`}</p>
          <Link
            href="/dashboard/hexstrike/tools"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hexstrike/tools"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wrench className="w-7 h-7 text-primary-400" />
              {tool.displayName}
            </h1>
            <p className="text-slate-400 mt-1">{tool.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tool.isInstalled ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              Installed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              <XCircle className="w-4 h-4" />
              Not Installed
            </span>
          )}
        </div>
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
                placeholder="e.g., example.com, 192.168.1.1"
                className={cn(
                  'w-full px-4 py-2.5 bg-dark-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors',
                  validationErrors.target ? 'border-red-500/50 focus:border-red-500' : 'border-dark-700 focus:border-primary-500/50'
                )}
              />
              {validationErrors.target && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.target}</p>
              )}
            </div>

            {/* Tool Parameters */}
            {tool.parameters && tool.parameters.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-dark-700">
                <h3 className="text-sm font-medium text-slate-400">Parameters</h3>
                {tool.parameters.map((param) => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {param.name}
                      {param.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {renderParameterInput(param)}
                    {validationErrors[param.name] && (
                      <p className="mt-1 text-sm text-red-400">{validationErrors[param.name]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Execute Button */}
            <div className="pt-4">
              <button
                onClick={handleExecute}
                disabled={executing || !tool.isInstalled}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  executing || !tool.isInstalled
                    ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                )}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Execute Tool
                  </>
                )}
              </button>
              {!tool.isInstalled && (
                <p className="mt-2 text-sm text-center text-slate-500">
                  This tool is not installed on the server
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Results Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary-400" />
              Results
            </h2>
            {execution && execution.status === 'running' && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>

          {/* No execution yet */}
          {!execution && !error && (
            <div className="text-center py-12 text-slate-400">
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Configure and execute the tool to see results</p>
            </div>
          )}

          {/* Error display */}
          {error && !execution && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-400 mb-1">Execution Failed</h4>
                  <p className="text-sm text-slate-400">{error}</p>
                  <button
                    onClick={handleExecute}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Execution status and results */}
          {execution && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = statusConfig[execution.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <>
                        <div className={cn('p-2 rounded-lg', config.bg)}>
                          <StatusIcon className={cn('w-4 h-4', config.color, execution.status === 'running' && 'animate-spin')} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white capitalize">{execution.status}</div>
                          <div className="text-xs text-slate-500">
                            Target: {execution.target}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {execution.pid && (
                  <div className="text-xs text-slate-500">
                    PID: {execution.pid}
                  </div>
                )}
              </div>

              {/* Error message */}
              {execution.status === 'failed' && execution.error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-400 mb-1">Error</h4>
                      <p className="text-sm text-slate-400">{execution.error}</p>
                      <div className="mt-3 text-sm text-slate-500">
                        <p className="font-medium mb-1">Suggestions:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Check if the target is reachable</li>
                          <li>Verify the tool is properly installed</li>
                          <li>Review the parameters and try again</li>
                        </ul>
                      </div>
                      <button
                        onClick={handleExecute}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Output */}
              {execution.output && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Output</h3>
                  <pre className="p-4 bg-dark-800/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {execution.output}
                  </pre>
                </div>
              )}

              {/* Results */}
              {execution.results && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Results</h3>
                  {renderResults(execution.results)}
                </div>
              )}

              {/* Running indicator */}
              {execution.status === 'running' && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Execution in progress...</p>
                    <p className="text-xs text-slate-500 mt-1">Results will appear here when complete</p>
                  </div>
                </div>
              )}
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
            <h3 className="text-lg font-semibold text-white mb-2">Cancel Execution?</h3>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure you want to cancel this execution? This action cannot be undone.
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
                Cancel Execution
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
