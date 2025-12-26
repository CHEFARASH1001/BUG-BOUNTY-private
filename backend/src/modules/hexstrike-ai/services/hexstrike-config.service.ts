import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HexStrikeConfig, HexStrikeConfigDocument } from '../schemas/hexstrike-config.schema';
import { HexStrikeConfig as HexStrikeConfigInterface } from '../interfaces/hexstrike.interface';

/**
 * Service for managing HexStrike AI configuration persistence
 * Requirements: 8.3, 8.4
 */
@Injectable()
export class HexStrikeConfigService {
  private readonly logger = new Logger(HexStrikeConfigService.name);
  private readonly DEFAULT_CONFIG_NAME = 'default';

  constructor(
    @InjectModel(HexStrikeConfig.name)
    private readonly configModel: Model<HexStrikeConfigDocument>,
  ) {}

  /**
   * Get the current HexStrike AI configuration
   * Creates default configuration if none exists
   */
  async getConfig(): Promise<HexStrikeConfigInterface> {
    const config = await this.configModel.findOne({
      configName: this.DEFAULT_CONFIG_NAME,
      isActive: true,
    });

    if (!config) {
      this.logger.log('No configuration found, creating default configuration');
      const newConfig = await this.createDefaultConfig();
      return this.toConfigInterface(newConfig);
    }

    return this.toConfigInterface(config);
  }

  /**
   * Update the HexStrike AI configuration
   * Applies changes without requiring container restart
   * Requirements: 8.3, 8.4
   */
  async updateConfig(
    updates: Partial<HexStrikeConfigInterface>,
  ): Promise<HexStrikeConfigInterface> {
    const existingConfig = await this.configModel.findOne({
      configName: this.DEFAULT_CONFIG_NAME,
    });

    const config = existingConfig || await this.createDefaultConfig();

    // Apply updates
    if (updates.threads !== undefined) {
      config.threads = updates.threads;
    }
    if (updates.timeout !== undefined) {
      config.timeout = updates.timeout;
    }
    if (updates.rateLimit !== undefined) {
      config.rateLimit = updates.rateLimit;
    }
    if (updates.scanDepth !== undefined) {
      config.scanDepth = updates.scanDepth;
    }
    if (updates.outputDir !== undefined) {
      config.outputDir = updates.outputDir;
    }
    if (updates.version !== undefined) {
      config.version = updates.version;
    }

    await config.save();
    this.logger.log('Configuration updated successfully');

    return this.toConfigInterface(config);
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<HexStrikeConfigDocument> {
    const defaultConfig = new this.configModel({
      configName: this.DEFAULT_CONFIG_NAME,
      threads: 10,
      timeout: 300,
      rateLimit: 10,
      scanDepth: 3,
      outputDir: '/app/results',
      isActive: true,
    });

    return defaultConfig.save();
  }

  /**
   * Convert MongoDB document to interface
   */
  private toConfigInterface(
    config: HexStrikeConfigDocument,
  ): HexStrikeConfigInterface {
    return {
      threads: config.threads,
      timeout: config.timeout,
      rateLimit: config.rateLimit,
      scanDepth: config.scanDepth,
      outputDir: config.outputDir,
      version: config.version,
    };
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<HexStrikeConfigInterface> {
    await this.configModel.deleteOne({ configName: this.DEFAULT_CONFIG_NAME });
    const config = await this.createDefaultConfig();
    this.logger.log('Configuration reset to defaults');
    return this.toConfigInterface(config);
  }
}
