import { StudioApiError } from './api-client.js';
import type { ErrorCategory, McpError } from './contracts.js';
import { redactText } from './redaction.js';

const categoryForStatus = (status: number): ErrorCategory => {
  if (status === 400 || status === 422 || status === 428) return 'validation';
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 409) return 'conflict';
  if (status === 502 || status === 504) return 'dependency';
  if (status === 503) return 'platform_readiness';
  return 'internal';
};

const stringField = (value: unknown, key: string): string | undefined =>
  value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string'
    ? String((value as Record<string, unknown>)[key]) : undefined;

const objectField = (value: unknown, key: string): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : undefined;
};

const categoryForContract = (status: number, code: string, classification?: string): ErrorCategory => {
  if (code === 'database_unavailable' || code === 'encryption_not_configured' || classification === 'database_or_schema_drift') {
    return 'platform_readiness';
  }
  if (code === 'keycloak_unavailable' || classification === 'keycloak_dependency' || classification === 'keycloak_reconcile') {
    return 'dependency';
  }
  return categoryForStatus(status);
};

export const normalizeError = (error: unknown): McpError => {
  if (error instanceof StudioApiError) {
    const contract = objectField(error.payload, 'error') ?? (error.payload as Record<string, unknown> | undefined);
    const code = stringField(contract, 'code') ?? 'studio_api_error';
    const classification = stringField(contract, 'classification');
    const diagnosticStatus = stringField(contract, 'status');
    const category = categoryForContract(error.status, code, classification);
    return {
      version: '1', code, category,
      retryable: (category === 'dependency' && diagnosticStatus !== 'blockiert') || error.status === 429,
      summary: redactText(stringField(contract, 'message') ?? `Studio-API antwortete mit HTTP ${error.status}.`),
      recommendedAction: stringField(contract, 'recommendedAction') ??
        (category === 'authentication' ? 'service_token_renew' : category === 'conflict' ? 'instance_inspect' : 'request_id_inspect'),
      requestId: stringField(error.payload, 'requestId') ?? error.requestId,
      idempotencyKey: error.idempotencyKey,
      httpStatus: error.status,
    };
  }
  return {
    version: '1', code: 'internal_unclassified', category: 'internal', retryable: false,
    summary: 'Der MCP-Aufruf konnte nicht sicher abgeschlossen werden.',
    recommendedAction: 'local_configuration_and_logs_inspect',
  };
};
