/**
 * Process Status Display Utilities
 * 
 * Helper functions for rendering HexStrike AI process status information.
 * These functions ensure consistent display of process data across the UI.
 * 
 * **Validates: Requirements 6.2**
 */

// Process status type
export type ProcessStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';

// Process interface matching backend
export interface HexStrikeProcess {
  pid: number;
  command: string;
  status: ProcessStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  output?: string;
  error?: string;
  tool?: string;
  target?: string;
}

// Status color configuration
export interface StatusColors {
  text: string;
  bg: string;
  border: string;
}

/**
 * Get color classes for a process status
 * 
 * Maps process status to consistent Tailwind CSS color classes.
 * - running: blue (active state)
 * - completed: green (success state)
 * - failed: red (error state)
 * - cancelled: yellow (warning state)
 * - pending: slate/gray (neutral state)
 * 
 * @param status - The process status
 * @returns Object with text, bg, and border color classes
 */
export function getStatusColors(status: ProcessStatus): StatusColors {
  switch (status) {
    case 'running':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
      };
    case 'completed':
      return {
        text: 'text-green-400',
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
      };
    case 'failed':
      return {
        text: 'text-red-400',
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
      };
    case 'cancelled':
      return {
        text: 'text-yellow-400',
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/30',
      };
    case 'pending':
    default:
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/20',
        border: 'border-slate-500/30',
      };
  }
}

/**
 * Get human-readable label for a process status
 * 
 * @param status - The process status
 * @returns Human-readable status label
 */
export function getStatusLabel(status: ProcessStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
      return 'Pending';
    default:
      return 'Unknown';
  }
}

/**
 * Format duration in milliseconds to human-readable string
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "1.5s", "2.3m", "1.2h")
 */
export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Calculate duration from start time to end time (or now if still running)
 * 
 * @param startTime - ISO date string of start time
 * @param endTime - Optional ISO date string of end time
 * @returns Duration in milliseconds
 */
export function calculateDuration(startTime: string, endTime?: string): number {
  const start = new Date(startTime).getTime();
  if (isNaN(start)) return 0;
  
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  if (isNaN(end)) return Date.now() - start;
  
  return Math.max(0, end - start);
}

/**
 * Check if a process can be terminated
 * 
 * Only running and pending processes can be terminated.
 * 
 * @param status - The process status
 * @returns True if the process can be terminated
 */
export function canTerminate(status: ProcessStatus): boolean {
  return status === 'running' || status === 'pending';
}

/**
 * Check if a process is in a terminal state (completed, failed, or cancelled)
 * 
 * @param status - The process status
 * @returns True if the process is in a terminal state
 */
export function isTerminalState(status: ProcessStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Validate that a process has all required display fields
 * 
 * Checks that a process object contains all fields required for display:
 * - pid (process ID)
 * - command (command being executed)
 * - status (current status)
 * - startTime (when the process started)
 * 
 * @param process - The process object to validate
 * @returns True if all required fields are present and valid
 */
export function hasRequiredDisplayFields(process: HexStrikeProcess): boolean {
  return (
    typeof process.pid === 'number' &&
    process.pid > 0 &&
    typeof process.command === 'string' &&
    process.command.length > 0 &&
    typeof process.status === 'string' &&
    ['running', 'completed', 'failed', 'cancelled', 'pending'].includes(process.status) &&
    typeof process.startTime === 'string' &&
    process.startTime.length > 0 &&
    !isNaN(new Date(process.startTime).getTime())
  );
}

/**
 * Get process display summary
 * 
 * Returns a summary object with all display-ready information for a process.
 * 
 * @param process - The process object
 * @returns Display summary with formatted values
 */
export function getProcessDisplaySummary(process: HexStrikeProcess): {
  pid: number;
  command: string;
  status: ProcessStatus;
  statusLabel: string;
  statusColors: StatusColors;
  startTime: string;
  formattedStartTime: string;
  duration: number;
  formattedDuration: string;
  canTerminate: boolean;
  isTerminal: boolean;
  tool?: string;
  target?: string;
} {
  const duration = process.duration || calculateDuration(process.startTime, process.endTime);
  
  return {
    pid: process.pid,
    command: process.command,
    status: process.status,
    statusLabel: getStatusLabel(process.status),
    statusColors: getStatusColors(process.status),
    startTime: process.startTime,
    formattedStartTime: new Date(process.startTime).toLocaleString(),
    duration,
    formattedDuration: formatDuration(duration),
    canTerminate: canTerminate(process.status),
    isTerminal: isTerminalState(process.status),
    tool: process.tool,
    target: process.target,
  };
}
