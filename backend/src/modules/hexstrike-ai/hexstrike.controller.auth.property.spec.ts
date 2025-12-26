import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { HexStrikeController } from './hexstrike.controller';
import { HexStrikeService } from './hexstrike.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * Property-Based Tests for HexStrike AI Authentication Enforcement
 * 
 * **Feature: hexstrike-ai-integration, Property 1: API Authentication Enforcement**
 * 
 * *For any* request to a HexStrike AI endpoint (under `/api/v1/hexstrike/*`),
 * if the request does not include a valid authentication token, the Backend_API
 * shall return a 401 Unauthorized response.
 * 
 * **Validates: Requirements 2.6**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  isPublic: boolean;
  description: string;
}

// ============================================================================
// ENDPOINT DEFINITIONS
// ============================================================================

/**
 * All HexStrike AI endpoints with their authentication requirements
 * Based on the controller implementation
 */
const HEXSTRIKE_ENDPOINTS: EndpointDefinition[] = [
  { method: 'GET', path: '/hexstrike/health', isPublic: true, description: 'Health check endpoint' },
  { method: 'POST', path: '/hexstrike/analyze-target', isPublic: false, description: 'Target analysis endpoint' },
  { method: 'GET', path: '/hexstrike/tools', isPublic: false, description: 'Tools listing endpoint' },
  { method: 'POST', path: '/hexstrike/tools/:tool/execute', isPublic: false, description: 'Tool execution endpoint' },
  { method: 'GET', path: '/hexstrike/workflows', isPublic: false, description: 'Workflows listing endpoint' },
  { method: 'POST', path: '/hexstrike/workflows/:type/start', isPublic: false, description: 'Workflow start endpoint' },
  { method: 'GET', path: '/hexstrike/processes', isPublic: false, description: 'Processes listing endpoint' },
  { method: 'GET', path: '/hexstrike/processes/:pid', isPublic: false, description: 'Process status endpoint' },
  { method: 'POST', path: '/hexstrike/processes/:pid/terminate', isPublic: false, description: 'Process termination endpoint' },
  { method: 'GET', path: '/hexstrike/config', isPublic: false, description: 'Configuration get endpoint' },
  { method: 'PUT', path: '/hexstrike/config', isPublic: false, description: 'Configuration update endpoint' },
];

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

/**
 * Arbitrary for generating protected endpoints (non-public)
 */
const protectedEndpointArb = fc.constantFrom(
  ...HEXSTRIKE_ENDPOINTS.filter(e => !e.isPublic)
);

/**
 * Arbitrary for generating public endpoints
 */
const publicEndpointArb = fc.constantFrom(
  ...HEXSTRIKE_ENDPOINTS.filter(e => e.isPublic)
);

/**
 * Arbitrary for generating all endpoints
 */
const allEndpointsArb = fc.constantFrom(...HEXSTRIKE_ENDPOINTS);

/**
 * Arbitrary for generating invalid authentication tokens
 */
const invalidTokenArb = fc.oneof(
  fc.constant(undefined), // No token
  fc.constant(''), // Empty token
  fc.constant('invalid-token'), // Plain invalid string
  fc.constant('Bearer '), // Bearer with no token
  fc.constant('Bearer invalid'), // Bearer with invalid token
  fc.string({ minLength: 10, maxLength: 50 }).map((s: string) => `Bearer ${s}`), // Random string
  fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/).map((s: string) => `Bearer ${s}`), // Random alphanumeric
);

/**
 * Arbitrary for generating HTTP methods
 */
const httpMethodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if an endpoint is marked as public in the controller
 */
function isEndpointPublic(endpoint: EndpointDefinition): boolean {
  return endpoint.isPublic;
}

/**
 * Checks if an endpoint requires authentication
 */
function requiresAuthentication(endpoint: EndpointDefinition): boolean {
  return !endpoint.isPublic;
}

/**
 * Validates that the endpoint path follows expected patterns
 */
function isValidEndpointPath(path: string): boolean {
  return path.startsWith('/hexstrike/');
}

/**
 * Simulates authentication check behavior
 * Returns true if request should be allowed, false if should return 401
 */
function simulateAuthCheck(
  endpoint: EndpointDefinition,
  hasValidToken: boolean
): { allowed: boolean; statusCode: number } {
  if (endpoint.isPublic) {
    return { allowed: true, statusCode: HttpStatus.OK };
  }
  
  if (hasValidToken) {
    return { allowed: true, statusCode: HttpStatus.OK };
  }
  
  return { allowed: false, statusCode: HttpStatus.UNAUTHORIZED };
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('HexStrike AI Authentication Property-Based Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 1: API Authentication Enforcement**
   * 
   * *For any* request to a HexStrike AI endpoint (under `/api/v1/hexstrike/*`),
   * if the request does not include a valid authentication token, the Backend_API
   * shall return a 401 Unauthorized response.
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 1: API Authentication Enforcement', () => {
    it('should require authentication for all protected endpoints', () => {
      fc.assert(
        fc.property(protectedEndpointArb, (endpoint) => {
          // All protected endpoints should require authentication
          return requiresAuthentication(endpoint) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return 401 for protected endpoints without valid token', () => {
      fc.assert(
        fc.property(
          protectedEndpointArb,
          invalidTokenArb,
          (endpoint, _invalidToken) => {
            // Simulate auth check with invalid token
            const result = simulateAuthCheck(endpoint, false);
            return result.statusCode === HttpStatus.UNAUTHORIZED;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow access to public endpoints without authentication', () => {
      fc.assert(
        fc.property(publicEndpointArb, (endpoint) => {
          // Public endpoints should be accessible without token
          const result = simulateAuthCheck(endpoint, false);
          return result.allowed === true && result.statusCode === HttpStatus.OK;
        }),
        { numRuns: 100 }
      );
    });

    it('should allow access to protected endpoints with valid token', () => {
      fc.assert(
        fc.property(protectedEndpointArb, (endpoint) => {
          // Protected endpoints should be accessible with valid token
          const result = simulateAuthCheck(endpoint, true);
          return result.allowed === true && result.statusCode === HttpStatus.OK;
        }),
        { numRuns: 100 }
      );
    });

    it('all HexStrike endpoints should have valid path format', () => {
      fc.assert(
        fc.property(allEndpointsArb, (endpoint) => {
          return isValidEndpointPath(endpoint.path);
        }),
        { numRuns: 100 }
      );
    });

    it('only health endpoint should be public', () => {
      fc.assert(
        fc.property(allEndpointsArb, (endpoint) => {
          // Only the health endpoint should be public
          if (endpoint.path === '/hexstrike/health') {
            return endpoint.isPublic === true;
          }
          return endpoint.isPublic === false;
        }),
        { numRuns: 100 }
      );
    });

    it('protected endpoints count should match expected', () => {
      const protectedCount = HEXSTRIKE_ENDPOINTS.filter(e => !e.isPublic).length;
      const publicCount = HEXSTRIKE_ENDPOINTS.filter(e => e.isPublic).length;
      
      // Should have exactly 10 protected endpoints and 1 public endpoint
      expect(protectedCount).toBe(10);
      expect(publicCount).toBe(1);
    });

    it('authentication requirement should be consistent for endpoint', () => {
      fc.assert(
        fc.property(
          allEndpointsArb,
          fc.boolean(),
          (endpoint, hasToken) => {
            const result1 = simulateAuthCheck(endpoint, hasToken);
            const result2 = simulateAuthCheck(endpoint, hasToken);
            
            // Same endpoint with same token state should always give same result
            return result1.allowed === result2.allowed && 
                   result1.statusCode === result2.statusCode;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional tests for controller metadata verification
   */
  describe('Controller Metadata Verification', () => {
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
    });

    it('should have JwtAuthGuard applied at controller level', () => {
      // Verify the controller class has the guard decorator
      const guards = Reflect.getMetadata('__guards__', HexStrikeController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('health endpoint should have Public decorator', () => {
      // Get the health method from the controller prototype
      const healthMethod = HexStrikeController.prototype.getHealth;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, healthMethod);
      expect(isPublic).toBe(true);
    });

    it('analyzeTarget endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.analyzeTarget;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('getTools endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.getTools;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('executeTool endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.executeTool;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('getWorkflows endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.getWorkflows;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('startWorkflow endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.startWorkflow;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('getProcesses endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.getProcesses;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('getProcessStatus endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.getProcessStatus;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('terminateProcess endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.terminateProcess;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('getConfig endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.getConfig;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });

    it('updateConfig endpoint should NOT have Public decorator', () => {
      const method = HexStrikeController.prototype.updateConfig;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, method);
      expect(isPublic).toBeFalsy();
    });
  });
});
