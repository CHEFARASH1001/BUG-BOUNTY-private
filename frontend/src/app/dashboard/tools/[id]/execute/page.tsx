'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  ArrowLeft,
  Play,
  Square,
  Loader2,
  Terminal,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Download,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toolsApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';

// Configuration option interface
interface ConfigOption {
  name: string;
  flag: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
  default?: any;
}

// Tool interface
interface Tool {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  githubUrl: string;
  categories: string[];
  validation?: {
    isValid: boolean;
    lastChecked: string;
    stars: number;
    lastCommit: string;
    reason?: string;
  };
  installation?: {
    isInstalled: boolean;
    version?: string;
    binaryName: string;
    lastChecked: string;
  };
  configOptions?: ConfigOption[];
  userConfig?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Execution interface
interface ToolExecution {
  _id: string;
  tool: string;
  arguments: string[];
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  completedAt: string;
  duration: number;
  errorMessage?: string;
  createdAt: string;
}

// Execution status configuration
const executionStatusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Clock },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Loader2 },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Square },
};

// Troubleshooting suggestions based on error patterns
const getTroubleshootingSuggestions = (errorMessage: string, stderr: string): string[] => {
  const suggestions: string[] = [];
  const combinedError = `${errorMessage} ${stderr}`.toLowerCase();

  if (combinedError.includes('not found') || combinedError.includes('command not found')) {
    suggestions.push('Ensure the tool is installed and available in your PATH');
    suggestions.push('Try reinstalling the tool using the recommended installation method');
  }
  if (combinedError.includes('permission denied')) {
    suggestions.push('Check file permissions for the target or output directory');
    suggestions.push('Try running with elevated privileges if necessary');
  }
  if (combinedError.includes('timeout')) {
    suggestions.push('Increase the timeout value for longer operations');
    suggestions.push('Consider reducing the scope of the scan');
  }
  if (combinedError.includes('connection') || combinedError.includes('network')) {
    suggestions.push('Check your network connection');
    suggestions.push('Verify the target is accessible');
    suggestions.push('Check if a firewall is blocking the connection');
  }
  if (combinedError.includes('invalid') || combinedError.includes('argument')) {
    suggestions.push('Review the command arguments for typos');
    suggestions.push('Check the tool documentation for correct usage');
  }
  if (combinedError.includes('memory') || combinedError.includes('oom')) {
    suggestions.push('Reduce the number of concurrent threads');
    suggestions.push('Process targets in smaller batches');
  }

  // Default suggestions if no specific match
  if (suggestions.length === 0) {
    suggestions.push('Check the stderr output for more details');
    suggestions.push('Verify all required arguments are provided');
    suggestions.push('Consult the tool documentation on GitHub');
  }

  return suggestions;
};

export default function ToolExecutePage({ params }: { params: { id: string } }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Execution form state
  const [argumentsInput, setArgumentsInput] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  // Execution result state
  const [currentExecution, setCurrentExecution] = useState<ToolExecution | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Output display state
  const outputRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchTool = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await toolsApi.getById(params.id);
      setTool(response.data);
      // Initialize config values from userConfig
      if (response.data.userConfig) {
        setConfigValues(response.data.userConfig);
      }
    } catch (err: any) {
      console.error('Failed to fetch tool:', err);
      setError(err.response?.data?.message || 'Failed to load tool');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTool();
    
    // Connect to WebSocket
    socketClient.connect();
    
    return () => {
      // Cleanup polling and WebSocket subscriptions on unmount
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (currentExecution?._id) {
        socketClient.unsubscribeToolExecution(currentExecution._id);
      }
    };
  }, [params.id]);

  // Subscribe to WebSocket events for current execution
  useEffect(() => {
    if (!currentExecution?._id || currentExecution._id === 'error') return;
    
    // Subscribe to execution updates
    socketClient.subscribeToolExecution(currentExecution._id);
    
    // Handle output updates
    const handleOutput = (data: any) => {
      if (data.executionId === currentExecution._id) {
        setCurrentExecution((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stdout: data.stdout ?? prev.stdout,
            stderr: data.stderr ?? prev.stderr,
            status: data.status ?? prev.status,
            exitCode: data.exitCode ?? prev.exitCode,
            duration: data.duration ?? prev.duration,
            errorMessage: data.errorMessage ?? prev.errorMessage,
          };
        });
      }
    };
    
    // Handle status updates
    const handleStatus = (data: any) => {
      if (data.executionId === currentExecution._id) {
        setCurrentExecution((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status,
          };
        });
      }
    };
    
    // Handle completion
    const handleComplete = (data: any) => {
      if (data.executionId === currentExecution._id) {
        setCurrentExecution((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status || 'completed',
            stdout: data.stdout ?? prev.stdout,
            stderr: data.stderr ?? prev.stderr,
            exitCode: data.exitCode ?? prev.exitCode,
            duration: data.duration ?? prev.duration,
            completedAt: data.completedAt || new Date().toISOString(),
            errorMessage: data.errorMessage ?? prev.errorMessage,
          };
        });
        
        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    };
    
    const unsubOutput = socketClient.on('tool-execution:output', handleOutput);
    const unsubStatus = socketClient.on('tool-execution:status', handleStatus);
    const unsubComplete = socketClient.on('tool-execution:complete', handleComplete);
    
    return () => {
      unsubOutput();
      unsubStatus();
      unsubComplete();
      socketClient.unsubscribeToolExecution(currentExecution._id);
    };
  }, [currentExecution?._id]);

  // Auto-scroll output
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [currentExecution?.stdout, currentExecution?.stderr, autoScroll]);

  const handleConfigChange = (name: string, value: any) => {
    setConfigValues((prev) => ({ ...prev, [name]: value }));
  };

  // Build command preview
  const buildCommandPreview = useCallback(() => {
    if (!tool) return '';
    
    const binaryName = tool.installation?.binaryName || tool.name;
    const args = argumentsInput.trim();
    
    // Build config flags
    const configFlags: string[] = [];
    if (tool.configOptions) {
      for (const option of tool.configOptions) {
        const value = configValues[option.name];
        if (value !== undefined && value !== '' && value !== option.default) {
          if (option.type === 'boolean') {
            if (value) {
              configFlags.push(option.flag);
            }
          } else {
            configFlags.push(`${option.flag} ${value}`);
          }
        }
      }
    }
    
    const parts = [binaryName];
    if (configFlags.length > 0) {
      parts.push(configFlags.join(' '));
    }
    if (args) {
      parts.push(args);
    }
    
    return parts.join(' ');
  }, [tool, argumentsInput, configValues]);

  // Execute tool
  const handleExecute = async () => {
    if (!tool || executing) return;
    
    setExecuting(true);
    setCurrentExecution(null);
    
    try {
      // Parse arguments
      const args = argumentsInput.trim().split(/\s+/).filter(Boolean);
      
      // Add config flags to arguments
      if (tool.configOptions) {
        for (const option of tool.configOptions) {
          const value = configValues[option.name];
          if (value !== undefined && value !== '' && value !== option.default) {
            if (option.type === 'boolean') {
              if (value) {
                args.unshift(option.flag);
              }
            } else {
              args.unshift(option.flag, String(value));
            }
          }
        }
      }
      
      const response = await toolsApi.execute(tool._id, {
        arguments: args,
        config: configValues,
      });
      
      setCurrentExecution(response.data);
      
      // Start polling for updates if execution is running
      if (response.data.status === 'running' || response.data.status === 'pending') {
        startPolling(response.data._id);
      }
    } catch (err: any) {
      console.error('Failed to execute tool:', err);
      // Create a mock failed execution for display
      setCurrentExecution({
        _id: 'error',
        tool: tool._id,
        arguments: argumentsInput.trim().split(/\s+/).filter(Boolean),
        config: configValues,
        status: 'failed',
        stdout: '',
        stderr: '',
        exitCode: -1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
        errorMessage: err.response?.data?.message || 'Failed to execute tool',
        createdAt: new Date().toISOString(),
      });
    } finally {
      setExecuting(false);
    }
  };

  // Poll for execution updates
  const startPolling = (executionId: string) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    const interval = setInterval(async () => {
      try {
        const response = await toolsApi.getExecutions(params.id, { limit: 1 });
        const executions = response.data;
        
        if (executions.length > 0) {
          const latestExecution = executions.find((e: ToolExecution) => e._id === executionId);
          if (latestExecution) {
            setCurrentExecution(latestExecution);
            
            // Stop polling if execution is complete
            if (['completed', 'failed', 'cancelled'].includes(latestExecution.status)) {
              clearInterval(interval);
              setPollingInterval(null);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll execution status:', err);
      }
    }, 1000);
    
    setPollingInterval(interval);
  };

  // Copy output to clipboard
  const copyOutput = () => {
    if (!currentExecution) return;
    const output = `=== STDOUT ===\n${currentExecution.stdout || '(empty)'}\n\n=== STDERR ===\n${currentExecution.stderr || '(empty)'}`;
    navigator.clipboard.writeText(output);
  };

  // Download output
  const downloadOutput = () => {
    if (!currentExecution || !tool) return;
    const content = `=== STDOUT ===\n${currentExecution.stdout || '(empty)'}\n\n=== STDERR ===\n${currentExecution.stderr || '(empty)'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool.name}-execution-${currentExecution._id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Retry with modified arguments
  const handleRetry = () => {
    setCurrentExecution(null);
  };

  // Cancel running execution
  const handleCancel = async () => {
    if (!currentExecution || !isRunning) return;
    
    try {
      // Update local state to cancelled
      setCurrentExecution((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'cancelled',
          completedAt: new Date().toISOString(),
        };
      });
      
      // Stop polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      
      // Unsubscribe from WebSocket
      if (currentExecution._id) {
        socketClient.unsubscribeToolExecution(currentExecution._id);
      }
    } catch (err) {
      console.error('Failed to cancel execution:', err);
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading tool...</span>
        </div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-red-400 text-lg">{error || 'Tool not found'}</div>
        <Link
          href="/dashboard/tools"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>
      </div>
    );
  }

  const isInstalled = tool.installation?.isInstalled ?? false;
  const commandPreview = buildCommandPreview();
  const isRunning = currentExecution?.status === 'running' || currentExecution?.status === 'pending';
  const hasFailed = currentExecution?.status === 'failed';
  const troubleshootingSuggestions = hasFailed && currentExecution
    ? getTroubleshootingSuggestions(currentExecution.errorMessage || '', currentExecution.stderr || '')
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/tools/${tool._id}`}
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Terminal className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Execute {tool.displayName}</h1>
                <p className="text-sm text-slate-500">Run the tool with custom arguments</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Not Installed Warning */}
      {!isInstalled && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">Tool Not Installed</p>
            <p className="text-sm text-yellow-400/70">
              This tool is not installed on the system. Please install it before executing.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-400" />
            Execution Settings
          </h3>

          <div className="space-y-4">
            {/* Arguments Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Arguments
              </label>
              <textarea
                value={argumentsInput}
                onChange={(e) => setArgumentsInput(e.target.value)}
                placeholder="Enter command arguments (e.g., -d example.com -o output.txt)"
                rows={3}
                disabled={!isInstalled || isRunning}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter arguments as you would on the command line
              </p>
            </div>

            {/* Command Preview */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Command Preview
              </label>
              <div className="p-3 bg-dark-950 rounded-lg border border-dark-700">
                <code className="text-sm text-green-400 font-mono break-all">
                  $ {commandPreview || `${tool.installation?.binaryName || tool.name}`}
                </code>
              </div>
            </div>

            {/* Configuration Options Toggle */}
            {tool.configOptions && tool.configOptions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {showConfig ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {showConfig ? 'Hide' : 'Show'} Configuration Options ({tool.configOptions.length})
                </button>

                {showConfig && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-3"
                  >
                    {tool.configOptions.map((option) => (
                      <div key={option.name} className="p-3 bg-dark-800/50 rounded-lg">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <label className="text-sm font-medium text-white">
                              {option.name}
                              {option.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <p className="text-xs text-slate-500">{option.description}</p>
                            <p className="text-xs text-slate-600 font-mono">Flag: {option.flag}</p>
                          </div>
                        </div>
                        
                        {option.type === 'boolean' ? (
                          <label className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={configValues[option.name] ?? option.default ?? false}
                              onChange={(e) => handleConfigChange(option.name, e.target.checked)}
                              disabled={!isInstalled || isRunning}
                              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-300">Enable</span>
                          </label>
                        ) : option.type === 'number' ? (
                          <input
                            type="number"
                            value={configValues[option.name] ?? option.default ?? ''}
                            onChange={(e) => handleConfigChange(option.name, e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={option.default?.toString() || 'Enter value'}
                            disabled={!isInstalled || isRunning}
                            className="mt-2 w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 text-sm disabled:opacity-50"
                          />
                        ) : (
                          <input
                            type="text"
                            value={configValues[option.name] ?? option.default ?? ''}
                            onChange={(e) => handleConfigChange(option.name, e.target.value || undefined)}
                            placeholder={option.default?.toString() || 'Enter value'}
                            disabled={!isInstalled || isRunning}
                            className="mt-2 w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 text-sm disabled:opacity-50"
                          />
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={!isInstalled || executing || isRunning}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                isInstalled && !executing && !isRunning
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-slate-500 cursor-not-allowed'
              )}
            >
              {executing || isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {executing ? 'Starting...' : 'Running...'}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Execute Tool
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Output Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary-400" />
              Output
            </h3>
            {currentExecution && (
              <div className="flex items-center gap-2">
                {/* Cancel Button for running executions */}
                {isRunning && (
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors"
                    title="Cancel Execution"
                  >
                    <Square className="w-3 h-3" />
                    Cancel
                  </button>
                )}
                
                {/* Status Badge */}
                {(() => {
                  const statusConfig = executionStatusConfig[currentExecution.status];
                  const StatusIcon = statusConfig?.icon;
                  return (
                    <span className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
                      statusConfig?.bg,
                      statusConfig?.color
                    )}>
                      {StatusIcon && (
                        <StatusIcon className={cn(
                          'w-3 h-3',
                          currentExecution.status === 'running' && 'animate-spin'
                        )} />
                      )}
                      {statusConfig?.label}
                    </span>
                  );
                })()}
                
                {/* Duration */}
                {currentExecution.duration > 0 && (
                  <span className="text-xs text-slate-400">
                    {formatDuration(currentExecution.duration)}
                  </span>
                )}
                
                {/* Actions */}
                <button
                  onClick={copyOutput}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Copy Output"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadOutput}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Download Output"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Terminal Output */}
          <div className="flex-1 min-h-[300px] bg-dark-950 rounded-lg border border-dark-700 overflow-hidden flex flex-col">
            {!currentExecution ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Execute the tool to see output here</p>
                </div>
              </div>
            ) : (
              <>
                <pre
                  ref={outputRef}
                  className="flex-1 p-4 overflow-auto font-mono text-sm"
                >
                  {/* STDOUT */}
                  {currentExecution.stdout && (
                    <span className="text-green-400 whitespace-pre-wrap">
                      {currentExecution.stdout}
                    </span>
                  )}
                  {/* STDERR */}
                  {currentExecution.stderr && (
                    <span className="text-red-400 whitespace-pre-wrap">
                      {currentExecution.stderr}
                    </span>
                  )}
                  {/* Running indicator */}
                  {isRunning && (
                    <span className="text-blue-400 animate-pulse">▌</span>
                  )}
                  {/* Empty state */}
                  {!currentExecution.stdout && !currentExecution.stderr && !isRunning && (
                    <span className="text-slate-500">(no output)</span>
                  )}
                </pre>
                
                {/* Auto-scroll toggle */}
                <div className="px-4 py-2 border-t border-dark-700 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="w-3 h-3 rounded border-dark-600 bg-dark-700 text-primary-500"
                    />
                    Auto-scroll
                  </label>
                  {currentExecution.exitCode !== undefined && currentExecution.exitCode !== null && (
                    <span className={cn(
                      'text-xs',
                      currentExecution.exitCode === 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      Exit code: {currentExecution.exitCode}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Error Handling Section */}
      {hasFailed && currentExecution && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Execution Failed</h3>
              
              {/* Error Message */}
              {currentExecution.errorMessage && (
                <div className="mb-4">
                  <p className="text-sm text-red-300">{currentExecution.errorMessage}</p>
                </div>
              )}
              
              {/* Troubleshooting Suggestions */}
              {troubleshootingSuggestions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Troubleshooting Suggestions
                  </h4>
                  <ul className="space-y-1">
                    {troubleshootingSuggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-slate-500">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Retry Button */}
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry with Modified Arguments
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Success Message */}
      {currentExecution?.status === 'completed' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Execution Completed Successfully</p>
              <p className="text-sm text-green-400/70">
                Duration: {formatDuration(currentExecution.duration)}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
