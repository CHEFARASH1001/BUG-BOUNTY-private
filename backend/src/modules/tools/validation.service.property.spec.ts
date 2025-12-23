import * as fc from 'fast-check';
import { ValidationService, RepoMetrics } from './validation.service';

/**
 * Property-Based Tests for ValidationService
 *
 * These tests verify the correctness properties defined in the design document
 * for the security-tools-registry feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data

// Valid GitHub username: 1-39 alphanumeric characters or hyphens, cannot start/end with hyphen
const githubUsernameArb = fc.string({ minLength: 1, maxLength: 39 })
  .filter((s) => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(s) || /^[a-zA-Z0-9]$/.test(s));

// Valid GitHub repo name: alphanumeric, dots, hyphens, underscores
const githubRepoNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter((s) => /^[a-zA-Z0-9._-]+$/.test(s));

// Generate a valid GitHub URL
const validGitHubUrlArb = fc.tuple(githubUsernameArb, githubRepoNameArb)
  .map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

// Generate invalid URLs (various formats)
const invalidUrlArb = fc.oneof(
  // HTTP instead of HTTPS
  fc.tuple(githubUsernameArb, githubRepoNameArb)
    .map(([owner, repo]) => `http://github.com/${owner}/${repo}`),
  // Wrong domain
  fc.tuple(githubUsernameArb, githubRepoNameArb)
    .map(([owner, repo]) => `https://gitlab.com/${owner}/${repo}`),
  // Missing repo
  githubUsernameArb.map((owner) => `https://github.com/${owner}`),
  // Missing owner
  githubRepoNameArb.map((repo) => `https://github.com//${repo}`),
  // Random strings
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('github.com')),
  // Empty string
  fc.constant(''),
  // Just the domain
  fc.constant('https://github.com'),
  fc.constant('https://github.com/'),
);

// Generate star counts
const lowStarsArb = fc.integer({ min: 0, max: 99 });
const highStarsArb = fc.integer({ min: 100, max: 100000 });

// Generate dates for activity testing
// Use integer-based date generation to avoid NaN date issues
const recentDateArb = fc.integer({
  min: Date.now() - 11 * 30 * 24 * 60 * 60 * 1000, // 11 months ago
  max: Date.now(),
}).map((timestamp) => new Date(timestamp));

const oldDateArb = fc.integer({
  min: new Date('2015-01-01').getTime(),
  max: Date.now() - 13 * 30 * 24 * 60 * 60 * 1000, // 13 months ago
}).map((timestamp) => new Date(timestamp));

// Generate repo metrics
const validMetricsArb = fc.record({
  stars: highStarsArb,
  lastCommitDate: recentDateArb,
  openIssues: fc.integer({ min: 0, max: 1000 }),
  forks: fc.integer({ min: 0, max: 10000 }),
  license: fc.oneof(fc.constant(null), fc.constantFrom('MIT', 'Apache-2.0', 'GPL-3.0')),
});

const lowStarsMetricsArb = fc.record({
  stars: lowStarsArb,
  lastCommitDate: recentDateArb,
  openIssues: fc.integer({ min: 0, max: 1000 }),
  forks: fc.integer({ min: 0, max: 10000 }),
  license: fc.oneof(fc.constant(null), fc.constantFrom('MIT', 'Apache-2.0', 'GPL-3.0')),
});

const inactiveMetricsArb = fc.record({
  stars: highStarsArb,
  lastCommitDate: oldDateArb,
  openIssues: fc.integer({ min: 0, max: 1000 }),
  forks: fc.integer({ min: 0, max: 10000 }),
  license: fc.oneof(fc.constant(null), fc.constantFrom('MIT', 'Apache-2.0', 'GPL-3.0')),
});

describe('ValidationService Property-Based Tests', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  /**
   * **Feature: security-tools-registry, Property 4: GitHub URL Validation**
   *
   * *For any* tool creation request, the githubUrl field SHALL match the pattern
   * `https://github.com/{owner}/{repo}` and the system SHALL reject URLs not
   * matching this pattern.
   *
   * **Validates: Requirements 2.1**
   */
  describe('Property 4: GitHub URL Validation', () => {
    it('should accept valid GitHub URLs with pattern https://github.com/{owner}/{repo}', async () => {
      await fc.assert(
        fc.asyncProperty(
          validGitHubUrlArb,
          async (url) => {
            const result = service.validateGitHubUrl(url);
            return result.valid === true && result.owner !== undefined && result.repo !== undefined;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract correct owner and repo from valid URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          githubUsernameArb,
          githubRepoNameArb,
          async (owner, repo) => {
            const url = `https://github.com/${owner}/${repo}`;
            const result = service.validateGitHubUrl(url);
            return result.valid === true && 
                   result.owner === owner && 
                   result.repo === repo;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject invalid URLs that do not match the GitHub pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidUrlArb,
          async (url) => {
            const result = service.validateGitHubUrl(url);
            return result.valid === false && result.reason !== undefined && result.reason.length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle URLs with trailing slash', async () => {
      await fc.assert(
        fc.asyncProperty(
          githubUsernameArb,
          githubRepoNameArb,
          async (owner, repo) => {
            const url = `https://github.com/${owner}/${repo}/`;
            const result = service.validateGitHubUrl(url);
            return result.valid === true && 
                   result.owner === owner && 
                   result.repo === repo;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle URLs with .git suffix', async () => {
      await fc.assert(
        fc.asyncProperty(
          githubUsernameArb,
          githubRepoNameArb,
          async (owner, repo) => {
            const url = `https://github.com/${owner}/${repo}.git`;
            const result = service.validateGitHubUrl(url);
            return result.valid === true && 
                   result.owner === owner && 
                   result.repo === repo;
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: security-tools-registry, Property 5: Star Threshold Validation**
   *
   * *For any* repository metrics with stars < 100, the validation result SHALL be
   * invalid with reason containing "stars".
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 5: Star Threshold Validation', () => {
    it('should reject repositories with fewer than 100 stars', async () => {
      await fc.assert(
        fc.asyncProperty(
          lowStarsMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.reason !== undefined && 
                   result.reason.toLowerCase().includes('stars');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept repositories with 100 or more stars (when active)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            // Should be valid since it has enough stars and is active
            return result.valid === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include actual star count in rejection reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          lowStarsMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.reason !== undefined && 
                   result.reason.includes(String(metrics.stars));
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 6: Activity Threshold Validation**
   *
   * *For any* repository metrics with lastCommitDate older than 12 months from
   * current date, the validation result SHALL be invalid with reason containing
   * "activity" or "inactive".
   *
   * **Validates: Requirements 2.3**
   */
  describe('Property 6: Activity Threshold Validation', () => {
    it('should reject repositories inactive for more than 12 months', async () => {
      await fc.assert(
        fc.asyncProperty(
          inactiveMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.reason !== undefined && 
                   (result.reason.toLowerCase().includes('inactive') || 
                    result.reason.toLowerCase().includes('activity'));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept repositories active within the last 12 months', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            // Should be valid since it has enough stars and is active
            return result.valid === true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 7: Validation Rejection Reason**
   *
   * *For any* tool that fails validation, the rejection response SHALL include
   * a non-empty reason string explaining the failure.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 7: Validation Rejection Reason', () => {
    it('should provide non-empty reason for low star rejection', async () => {
      await fc.assert(
        fc.asyncProperty(
          lowStarsMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.reason !== undefined && 
                   result.reason.trim().length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should provide non-empty reason for inactivity rejection', async () => {
      await fc.assert(
        fc.asyncProperty(
          inactiveMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.reason !== undefined && 
                   result.reason.trim().length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should provide non-empty reason for invalid URL rejection', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidUrlArb,
          async (url) => {
            const result = service.validateGitHubUrl(url);
            return result.valid === false && 
                   result.reason !== undefined && 
                   result.reason.trim().length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include metrics in rejection response when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          lowStarsMetricsArb,
          async (metrics) => {
            const result = service.isLegitimate(metrics as RepoMetrics);
            return result.valid === false && 
                   result.metrics !== undefined &&
                   result.metrics.stars === metrics.stars;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
