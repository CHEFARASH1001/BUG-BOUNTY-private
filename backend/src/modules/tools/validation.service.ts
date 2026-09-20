import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  metrics?: RepoMetrics;
}

/**
 * GitHub URL parsing result
 */
export interface GitHubUrlParseResult {
  valid: boolean;
  owner?: string;
  repo?: string;
  reason?: string;
}

/**
 * Repository metrics from GitHub API
 */
export interface RepoMetrics {
  stars: number;
  lastCommitDate: Date;
  openIssues: number;
  forks: number;
  license: string | null;
}

// Minimum star threshold for tool legitimacy
const MIN_STARS_THRESHOLD = 100;
// Maximum months since last commit for a tool to be considered active.
const MAX_INACTIVE_MONTHS = 12;

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Validates a GitHub URL and extracts owner/repo components.
   * Valid format: https://github.com/{owner}/{repo}
   *
   * @param url - The GitHub URL to validate
   * @returns GitHubUrlParseResult with parsed components or error reason
   */
  validateGitHubUrl(url: string): GitHubUrlParseResult {
    if (!url || typeof url !== 'string') {
      return {
        valid: false,
        reason: 'Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}',
      };
    }

    const trimmedUrl = url.trim();

    // Pattern: https://github.com/{owner}/{repo} with optional trailing slash or .git
    const githubPattern = /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})\/([a-zA-Z0-9._-]+?)(?:\.git)?(?:\/)?$/;

    const match = trimmedUrl.match(githubPattern);

    if (!match) {
      return {
        valid: false,
        reason: 'Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}',
      };
    }

    const [, owner, repo] = match;

    // Additional validation for repo name (remove .git if present)
    const cleanRepo = repo.replace(/\.git$/, '');

    return {
      valid: true,
      owner,
      repo: cleanRepo,
    };
  }

  /**
   * Fetches repository metrics from GitHub API.
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns RepoMetrics or throws error on failure
   */
  async checkRepoMetrics(owner: string, repo: string): Promise<RepoMetrics> {
    try {
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
      const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'BugBounty-Tools-Registry',
      };

      // Add GitHub token if available for higher rate limits
      const githubToken = process.env.GITHUB_TOKEN;
      if (githubToken) {
        headers.Authorization = `token ${githubToken}`;
      }

      // Fetch repo info and latest commit in parallel
      const [repoResponse, commitsResponse] = await Promise.all([
        axios.get(repoUrl, { headers }),
        axios.get(commitsUrl, { headers }),
      ]);

      const repoData = repoResponse.data;
      const lastCommit = commitsResponse.data[0];

      return {
        stars: repoData.stargazers_count,
        lastCommitDate: new Date(lastCommit?.commit?.committer?.date || repoData.pushed_at),
        openIssues: repoData.open_issues_count,
        forks: repoData.forks_count,
        license: repoData.license?.spdx_id || null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('GitHub repository not found');
        }
        if (error.response?.status === 403) {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
      }
      this.logger.error(`Failed to fetch repo metrics for ${owner}/${repo}:`, error);
      throw new Error('Failed to fetch repository metrics from GitHub');
    }
  }

  /**
   * Checks if a repository meets legitimacy criteria.
   * Criteria:
   * - At least 100 stars
   * - Active within the last 12 months
   *
   * @param metrics - Repository metrics to evaluate
   * @returns ValidationResult with validity and reason if invalid
   */
  isLegitimate(metrics: RepoMetrics): ValidationResult {
    // Check star threshold
    if (metrics.stars < MIN_STARS_THRESHOLD) {
      return {
        valid: false,
        reason: `Repository has fewer than ${MIN_STARS_THRESHOLD} stars (found: ${metrics.stars})`,
        metrics,
      };
    }

    // Check activity threshold
    const now = new Date();
    const lastCommit = new Date(metrics.lastCommitDate);
    const monthsSinceLastCommit = this.getMonthsDifference(lastCommit, now);

    if (monthsSinceLastCommit > MAX_INACTIVE_MONTHS) {
      return {
        valid: false,
        reason: `Repository has been inactive for more than ${MAX_INACTIVE_MONTHS} months (last activity: ${monthsSinceLastCommit} months ago)`,
        metrics,
      };
    }

    return {
      valid: true,
      metrics,
    };
  }

  /**
   * Validates a GitHub repository URL and checks legitimacy.
   * This is the main validation entry point.
   *
   * @param url - GitHub repository URL
   * @returns ValidationResult with full validation status
   */
  async validateGitHubRepo(url: string): Promise<ValidationResult> {
    // Step 1: Validate URL format
    const urlResult = this.validateGitHubUrl(url);
    if (!urlResult.valid) {
      return {
        valid: false,
        reason: urlResult.reason,
      };
    }

    // Step 2: Fetch repository metrics
    let metrics: RepoMetrics;
    try {
      metrics = await this.checkRepoMetrics(urlResult.owner!, urlResult.repo!);
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Failed to validate repository',
      };
    }

    // Step 3: Check legitimacy
    return this.isLegitimate(metrics);
  }

  /**
   * Calculates the number of months between two dates.
   */
  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());
    return Math.max(0, months);
  }
}
