import { describe, expect, it } from 'vitest';
import { StudioApiError } from './api-client.js';
import { normalizeError } from './errors.js';

const fixture = (status: number, code: string, classification: string, diagnosticStatus: string) =>
  new StudioApiError(status, {
    error: {
      code,
      message: `message:${code}`,
      classification,
      status: diagnosticStatus,
      recommendedAction: `action:${code}`,
    },
    requestId: `server:${code}`,
  }, 'client-request');

describe('Studio API error contract', () => {
  it.each([
    [503, 'database_unavailable', 'database_or_schema_drift', 'blockiert', 'platform_readiness', false],
    [502, 'keycloak_unavailable', 'keycloak_dependency', 'degradiert', 'dependency', true],
    [401, 'unauthenticated', 'auth_resolution', 'blockiert', 'authentication', false],
    [500, 'internal_unclassified', 'unknown', 'degradiert', 'internal', false],
  ] as const)('maps %s/%s from the nested wire contract', (status, code, classification, diagnosticStatus, category, retryable) => {
    expect(normalizeError(fixture(status, code, classification, diagnosticStatus))).toMatchObject({
      code, category, retryable, requestId: `server:${code}`,
      summary: `message:${code}`, recommendedAction: `action:${code}`,
    });
  });
});
