import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ToolDocument = Tool & Document;

/**
 * Tool categories for classification
 * Requirements: 5.1, 5.2
 */
export enum ToolCategory {
  SUBDOMAIN_ENUMERATION = 'subdomain_enumeration',
  HTTP_PROBING = 'http_probing',
  DIRECTORY_FUZZING = 'directory_fuzzing',
  VULNERABILITY_SCANNING = 'vulnerability_scanning',
  SECRET_DETECTION = 'secret_detection',
  JAVASCRIPT_ANALYSIS = 'javascript_analysis',
  PORT_SCANNING = 'port_scanning',
  WAF_DETECTION = 'waf_detection',
  URL_DISCOVERY = 'url_discovery',
  OSINT = 'osint',
  DNS_TOOLS = 'dns_tools',
  WEB_CRAWLING = 'web_crawling',
  PARAMETER_DISCOVERY = 'parameter_discovery',
  EXPLOITATION = 'exploitation',
}

/**
 * Configuration option for a tool
 */
export interface ConfigOption {
  name: string;
  flag: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Validation result stored with the tool
 */
export interface ToolValidation {
  isValid: boolean;
  lastChecked: Date;
  stars: number;
  lastCommit: Date;
  reason?: string;
}

/**
 * Installation method types
 */
export type InstallMethod = 'go' | 'pip' | 'apt' | 'brew' | 'cargo' | 'npm' | 'git' | 'manual';

/**
 * Installation command for a specific method
 */
export interface InstallCommand {
  method: InstallMethod;
  command: string;
  postInstall?: string;
}

/**
 * Installation status for a tool
 */
export interface ToolInstallation {
  isInstalled: boolean;
  version?: string;
  binaryName: string;
  lastChecked: Date;
  installCommands?: InstallCommand[];
}

@Schema({ timestamps: true })
export class Tool {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  name: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  githubUrl: string;

  @Prop({ type: [String], enum: Object.values(ToolCategory), required: true })
  categories: ToolCategory[];

  @Prop({ type: Object })
  validation: ToolValidation;

  @Prop({ type: Object })
  installation: ToolInstallation;

  @Prop({ type: [Object], default: [] })
  configOptions: ConfigOption[];

  @Prop({ type: Object, default: {} })
  userConfig: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const ToolSchema = SchemaFactory.createForClass(Tool);

// Indexes for efficient querying
ToolSchema.index({ name: 1 });
ToolSchema.index({ categories: 1 });
ToolSchema.index({ 'validation.isValid': 1 });
ToolSchema.index({ 'installation.isInstalled': 1 });
ToolSchema.index({ isActive: 1 });
