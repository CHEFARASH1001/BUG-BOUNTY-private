import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { spawn, execSync, exec } from 'child_process';
import { Tool, ToolDocument, InstallMethod } from '../../schemas/tool.schema';
import { ToolExecution, ToolExecutionDocument, ExecutionStatus } from '../../schemas/tool-execution.schema';

/**
 * Execution options interface
 */
export interface ExecuteOptions {
  timeout?: number;
  workingDir?: string;
  env?: Record<string, string>;
}

/**
 * Tool installation status
 * Requirements: 3.1
 */
export interface ToolStatus {
  isInstalled: boolean;
  version?: string;
  hasUpdate: boolean;
  status: 'installed' | 'not_installed' | 'update_available';
}

/**
 * Installation result interface
 */
export interface InstallResult {
  success: boolean;
  method: InstallMethod;
  output: string;
  error?: string;
}

/**
 * Installation status enum values
 * Requirements: 3.1
 */
export type InstallationStatusEnum = 'installed' | 'not_installed' | 'update_available';

/**
 * Execution result interface
 */
export interface ExecutionResult {
  execution: ToolExecutionDocument;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    @InjectModel(Tool.name) private toolModel: Model<ToolDocument>,
    @InjectModel(ToolExecution.name) private toolExecutionModel: Model<ToolExecutionDocument>,
  ) {}

  /**
   * Checks if a tool binary exists in PATH.
   * 
   * Requirements: 3.1, 3.2
   * 
   * @param toolName - The name of the tool
   * @param binaryName - Optional binary name (defaults to toolName)
   * @returns Promise<boolean> - True if the tool is installed
   */
  async isInstalled(toolName: string, binaryName?: string): Promise<boolean> {
    const binary = binaryName || toolName;
    
    try {
      // Use 'which' on Unix-like systems, 'where' on Windows
      // Include common tool installation paths in PATH
      const command = process.platform === 'win32' ? 'where' : 'which';
      const extraPaths = [
        '/usr/local/bin',
        '/usr/bin',
        `${process.env.HOME}/go/bin`,
        `${process.env.HOME}/.local/bin`,
        `${process.env.HOME}/.cargo/bin`,
      ].join(':');
      const env = { ...process.env, PATH: `${extraPaths}:${process.env.PATH}` };
      execSync(`${command} ${binary}`, { stdio: 'pipe', env });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the installed version of a tool.
   * 
   * Requirements: 3.1, 3.2
   * 
   * @param toolName - The name of the tool
   * @param binaryName - Optional binary name (defaults to toolName)
   * @returns Promise<string | null> - Version string or null if not installed/version unavailable
   */
  async getVersion(toolName: string, binaryName?: string): Promise<string | null> {
    const binary = binaryName || toolName;
    
    // Check if installed first
    const installed = await this.isInstalled(toolName, binaryName);
    if (!installed) {
      return null;
    }

    // Try common version flags
    const versionFlags = ['--version', '-version', '-v', 'version'];
    
    for (const flag of versionFlags) {
      try {
        const output = execSync(`${binary} ${flag}`, { 
          stdio: 'pipe',
          timeout: 5000, // 5 second timeout
        }).toString().trim();
        
        // Extract version number from output
        const version = this.extractVersion(output);
        if (version) {
          return version;
        }
      } catch {
        // Try next flag
        continue;
      }
    }

    // If we couldn't get version but tool is installed, return 'unknown'
    return 'unknown';
  }

  /**
   * Extracts version number from command output.
   * Handles various version formats like "v1.2.3", "1.2.3", "version 1.2.3", etc.
   * 
   * @param output - Command output string
   * @returns Extracted version string or null
   */
  private extractVersion(output: string): string | null {
    // Common version patterns
    const patterns = [
      /v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/,  // v1.2.3 or 1.2.3 or 1.2.3-beta
      /version\s+v?(\d+\.\d+\.\d+)/i,           // version 1.2.3
      /(\d+\.\d+\.\d+)/,                         // Any x.y.z pattern
      /v?(\d+\.\d+)/,                            // x.y pattern
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Gets the full installation status of a tool.
   * 
   * Requirements: 3.1, 3.2, 3.3
   * 
   * @param tool - The tool document
   * @param latestVersion - Optional latest version for comparison
   * @returns Promise<ToolStatus> - Complete installation status
   */
  async getInstallationStatus(tool: ToolDocument, latestVersion?: string): Promise<ToolStatus> {
    const binaryName = tool.installation?.binaryName || tool.name;
    const isInstalled = await this.isInstalled(tool.name, binaryName);
    
    if (!isInstalled) {
      return {
        isInstalled: false,
        hasUpdate: false,
        status: 'not_installed',
      };
    }

    const version = await this.getVersion(tool.name, binaryName);
    
    // Check for updates if we have both versions
    let hasUpdate = false;
    if (version && latestVersion && version !== 'unknown') {
      hasUpdate = this.compareVersions(version, latestVersion) < 0;
    }

    return {
      isInstalled: true,
      version: version || undefined,
      hasUpdate,
      status: hasUpdate ? 'update_available' : 'installed',
    };
  }

  /**
   * Compares two semantic version strings.
   * 
   * Requirements: 3.3
   * 
   * @param installed - Installed version string
   * @param latest - Latest version string
   * @returns -1 if installed < latest, 0 if equal, 1 if installed > latest
   */
  compareVersions(installed: string, latest: string): number {
    // Normalize versions by removing 'v' prefix
    const normalizeVersion = (v: string) => v.replace(/^v/, '');
    
    const installedParts = normalizeVersion(installed).split('.').map(p => {
      // Handle versions like "1.2.3-beta" by taking only the numeric part
      const num = parseInt(p.split('-')[0], 10);
      return isNaN(num) ? 0 : num;
    });
    
    const latestParts = normalizeVersion(latest).split('.').map(p => {
      const num = parseInt(p.split('-')[0], 10);
      return isNaN(num) ? 0 : num;
    });

    // Pad arrays to same length
    const maxLength = Math.max(installedParts.length, latestParts.length);
    while (installedParts.length < maxLength) installedParts.push(0);
    while (latestParts.length < maxLength) latestParts.push(0);

    // Compare each part
    for (let i = 0; i < maxLength; i++) {
      if (installedParts[i] < latestParts[i]) return -1;
      if (installedParts[i] > latestParts[i]) return 1;
    }

    return 0;
  }

  /**
   * Executes a tool with the given arguments.
   * 
   * Requirements: 4.1, 4.2, 4.3
   * 
   * @param tool - The tool to execute
   * @param args - Command line arguments
   * @param options - Execution options
   * @returns Promise<ToolExecutionDocument> - The execution record
   * @throws BadRequestException if tool is not installed
   */
  async execute(
    tool: ToolDocument,
    args: string[],
    options?: ExecuteOptions,
  ): Promise<ToolExecutionDocument> {
    const binaryName = tool.installation?.binaryName || tool.name;
    
    // Requirement 4.1: Validate tool is installed before proceeding
    const isInstalled = await this.isInstalled(tool.name, binaryName);
    if (!isInstalled) {
      throw new BadRequestException(
        `Tool '${tool.displayName}' is not installed. Please install it first.`
      );
    }

    // Create execution record
    const execution = new this.toolExecutionModel({
      tool: tool._id,
      arguments: args,
      config: tool.userConfig || {},
      status: ExecutionStatus.PENDING,
      stdout: '',
      stderr: '',
      startedAt: new Date(),
    });
    await execution.save();

    // Update status to running
    execution.status = ExecutionStatus.RUNNING;
    await execution.save();

    const startTime = Date.now();

    return new Promise((resolve) => {
      const childProcess = spawn(binaryName, args, {
        cwd: options?.workingDir,
        env: { ...process.env, ...options?.env },
        shell: '/bin/sh',
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | undefined;

      // Set up timeout if specified
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          childProcess.kill('SIGTERM');
          execution.status = ExecutionStatus.FAILED;
          execution.errorMessage = `Tool execution timed out after ${options.timeout}ms`;
        }, options.timeout);
      }

      // Capture stdout (Requirement 4.2)
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr (Requirement 4.2)
      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', async (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Update execution record (Requirement 4.3)
        execution.stdout = stdout;
        execution.stderr = stderr;
        execution.exitCode = code ?? -1;
        execution.completedAt = new Date();
        execution.duration = duration;

        if (code === 0) {
          execution.status = ExecutionStatus.COMPLETED;
        } else {
          execution.status = ExecutionStatus.FAILED;
          // Requirement 4.4: Provide error message on failure
          execution.errorMessage = stderr || `Tool exited with code ${code}`;
        }

        await execution.save();
        resolve(execution);
      });

      childProcess.on('error', async (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        execution.stdout = stdout;
        execution.stderr = stderr;
        execution.exitCode = -1;
        execution.completedAt = new Date();
        execution.duration = duration;
        execution.status = ExecutionStatus.FAILED;
        execution.errorMessage = error.message;

        await execution.save();
        resolve(execution);
      });
    });
  }

  /**
   * Gets execution history for a tool.
   * 
   * Requirements: 8.1, 8.3
   * 
   * @param toolId - The tool ID
   * @param limit - Maximum number of executions to return (default 10)
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @param status - Optional status filter
   * @returns Promise<ToolExecutionDocument[]> - Array of execution records
   */
  async getExecutionHistory(
    toolId: string,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    status?: ExecutionStatus,
  ): Promise<ToolExecutionDocument[]> {
    const filter: Record<string, any> = {
      tool: new Types.ObjectId(toolId),
    };

    // Date range filter (Requirement 8.3)
    if (startDate || endDate) {
      filter.startedAt = {};
      if (startDate) {
        filter.startedAt.$gte = startDate;
      }
      if (endDate) {
        filter.startedAt.$lte = endDate;
      }
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Requirement 8.1: Return last N executions
    return this.toolExecutionModel
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Gets a single execution by ID.
   * 
   * Requirements: 8.2
   * 
   * @param executionId - The execution ID
   * @returns Promise<ToolExecutionDocument | null> - The execution record
   */
  async getExecutionById(executionId: string): Promise<ToolExecutionDocument | null> {
    return this.toolExecutionModel.findById(executionId).exec();
  }

  /**
   * Detects available package managers on the system.
   * 
   * @returns Array of available install methods
   */
  async detectAvailablePackageManagers(): Promise<InstallMethod[]> {
    const managers: InstallMethod[] = [];
    const checks: { method: InstallMethod; command: string }[] = [
      { method: 'go', command: 'go version' },
      { method: 'pip', command: 'pip --version' },
      { method: 'apt', command: 'apt --version' },
      { method: 'brew', command: 'brew --version' },
      { method: 'cargo', command: 'cargo --version' },
      { method: 'npm', command: 'npm --version' },
      { method: 'git', command: 'git --version' },
    ];

    for (const check of checks) {
      try {
        execSync(check.command, { stdio: 'pipe', timeout: 5000 });
        managers.push(check.method);
      } catch {
        // Package manager not available
      }
    }

    return managers;
  }

  /**
   * Installs a tool using the specified method or auto-detects the best method.
   * 
   * @param tool - The tool to install
   * @param preferredMethod - Optional preferred installation method
   * @returns Promise<InstallResult> - Installation result
   */
  async installTool(tool: ToolDocument, preferredMethod?: InstallMethod): Promise<InstallResult> {
    const installCommands = tool.installation?.installCommands || [];
    
    if (installCommands.length === 0) {
      return {
        success: false,
        method: 'manual' as InstallMethod,
        output: '',
        error: `No installation commands available for ${tool.displayName}. Please install manually from ${tool.githubUrl}`,
      };
    }

    // Get available package managers
    const availableManagers = await this.detectAvailablePackageManagers();
    this.logger.log(`Available package managers: ${availableManagers.join(', ')}`);

    // Find the best installation command
    let selectedCommand = installCommands.find(cmd => cmd.method === preferredMethod && availableManagers.includes(cmd.method));
    
    if (!selectedCommand) {
      // Auto-select based on priority and availability
      const priority: InstallMethod[] = ['apt', 'brew', 'pip', 'go', 'cargo', 'npm', 'git'];
      for (const method of priority) {
        selectedCommand = installCommands.find(cmd => cmd.method === method && availableManagers.includes(method));
        if (selectedCommand) break;
      }
    }

    if (!selectedCommand) {
      const availableMethods = installCommands.map(c => c.method).join(', ');
      return {
        success: false,
        method: 'manual' as InstallMethod,
        output: '',
        error: `No compatible package manager found. Tool requires: ${availableMethods}. Available: ${availableManagers.join(', ')}`,
      };
    }

    this.logger.log(`Installing ${tool.displayName} using ${selectedCommand.method}: ${selectedCommand.command}`);

    return new Promise((resolve) => {
      exec(selectedCommand!.command, { 
        timeout: 300000, // 5 minute timeout
        shell: '/bin/sh', // Use sh which is available in Alpine containers
        env: { ...process.env, PATH: `${process.env.HOME}/go/bin:${process.env.PATH}` },
      }, async (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Installation failed for ${tool.displayName}: ${error.message}`);
          resolve({
            success: false,
            method: selectedCommand!.method,
            output: stdout,
            error: stderr || error.message,
          });
          return;
        }

        // Run post-install if specified
        if (selectedCommand!.postInstall) {
          try {
            execSync(selectedCommand!.postInstall, { 
              stdio: 'pipe', 
              timeout: 60000,
              shell: '/bin/sh',
            });
          } catch (postError) {
            this.logger.warn(`Post-install command failed: ${postError}`);
          }
        }

        // Verify installation
        const isNowInstalled = await this.isInstalled(tool.name, tool.installation?.binaryName);
        
        if (isNowInstalled) {
          // Update tool installation status
          tool.installation = {
            ...tool.installation!,
            isInstalled: true,
            lastChecked: new Date(),
            version: await this.getVersion(tool.name, tool.installation?.binaryName) || undefined,
          };
          await tool.save();

          this.logger.log(`Successfully installed ${tool.displayName}`);
          resolve({
            success: true,
            method: selectedCommand!.method,
            output: stdout + '\n' + stderr,
          });
        } else {
          resolve({
            success: false,
            method: selectedCommand!.method,
            output: stdout,
            error: 'Installation completed but tool binary not found in PATH. You may need to restart your terminal or add the install location to PATH.',
          });
        }
      });
    });
  }

  /**
   * Gets available installation methods for a tool.
   * 
   * @param tool - The tool document
   * @returns Available installation methods with their commands
   */
  async getAvailableInstallMethods(tool: ToolDocument): Promise<{ method: InstallMethod; command: string; available: boolean }[]> {
    const installCommands = tool.installation?.installCommands || [];
    const availableManagers = await this.detectAvailablePackageManagers();

    return installCommands.map(cmd => ({
      method: cmd.method,
      command: cmd.command,
      available: availableManagers.includes(cmd.method),
    }));
  }
}
