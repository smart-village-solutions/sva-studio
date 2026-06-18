import type {
  ApiErrorResponse,
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeRecommendedAction,
  IamRuntimeSafeDetails,
} from '@sva/core';
import {
  deriveIamRuntimeDiagnostics,
  iamRuntimeDiagnosticClassifications,
  iamRuntimeDiagnosticStatuses,
  iamRuntimeRecommendedActions,
} from '@sva/core';

export type IamErrorPayload =
  | ApiErrorResponse
  | {
      readonly error?: string;
      readonly message?: string;
      readonly requestId?: string;
    };

const KNOWN_RUNTIME_DIAGNOSTIC_CLASSIFICATIONS = new Set<IamRuntimeDiagnosticClassification>(
  iamRuntimeDiagnosticClassifications
);
const KNOWN_RUNTIME_DIAGNOSTIC_STATUSES = new Set<IamRuntimeDiagnosticStatus>(
  iamRuntimeDiagnosticStatuses
);
const KNOWN_RUNTIME_RECOMMENDED_ACTIONS = new Set<IamRuntimeRecommendedAction>(
  iamRuntimeRecommendedActions
);

const hasTopLevelMessage = (
  payload: IamErrorPayload
): payload is IamErrorPayload & { readonly message?: unknown } => 'message' in payload;

const readStructuredErrorPayload = (payload: IamErrorPayload | null) =>
  payload && typeof payload.error === 'object' && payload.error
    ? (payload.error as Record<string, unknown>)
    : undefined;

const readErrorDetailsRecord = (
  payload: IamErrorPayload | null
): Record<string, unknown> | undefined => {
  if (
    !payload ||
    typeof payload.error !== 'object' ||
    !payload.error ||
    !('details' in payload.error)
  ) {
    return undefined;
  }

  const details = (payload.error as { details?: unknown }).details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined;
};

const readStringDetail = (source: Record<string, unknown>, key: string): string | undefined =>
  typeof source[key] === 'string' ? (source[key] as string) : undefined;

const readSyncState = (source: Record<string, unknown>): string | undefined =>
  readStringDetail(source, 'sync_state') ?? readStringDetail(source, 'syncState');

const readSyncErrorRecord = (
  source: Record<string, unknown>
): Record<string, unknown> | undefined =>
  typeof source.syncError === 'object' && source.syncError !== null
    ? (source.syncError as Record<string, unknown>)
    : undefined;

const readSyncErrorCode = (source: Record<string, unknown>): string | undefined =>
  readStringDetail(source, 'sync_error_code') ??
  readStringDetail(source, 'syncErrorCode') ??
  readStringDetail(readSyncErrorRecord(source) ?? {}, 'code');

const hasStringValues = (details: IamRuntimeSafeDetails): boolean =>
  Object.values(details).some((value) => typeof value === 'string');

const normalizeRuntimeDiagnosticClassification = (
  value: unknown,
  fallback: IamRuntimeDiagnosticClassification
): IamRuntimeDiagnosticClassification =>
  typeof value === 'string' &&
  KNOWN_RUNTIME_DIAGNOSTIC_CLASSIFICATIONS.has(value as IamRuntimeDiagnosticClassification)
    ? (value as IamRuntimeDiagnosticClassification)
    : fallback;

const normalizeRuntimeDiagnosticStatus = (
  value: unknown,
  fallback: IamRuntimeDiagnosticStatus
): IamRuntimeDiagnosticStatus =>
  typeof value === 'string' &&
  KNOWN_RUNTIME_DIAGNOSTIC_STATUSES.has(value as IamRuntimeDiagnosticStatus)
    ? (value as IamRuntimeDiagnosticStatus)
    : fallback;

const normalizeRuntimeRecommendedAction = (
  value: unknown,
  fallback: IamRuntimeRecommendedAction
): IamRuntimeRecommendedAction =>
  typeof value === 'string' &&
  KNOWN_RUNTIME_RECOMMENDED_ACTIONS.has(value as IamRuntimeRecommendedAction)
    ? (value as IamRuntimeRecommendedAction)
    : fallback;

const readExplicitSafeDetails = (
  structuredError: Record<string, unknown> | undefined
): IamRuntimeSafeDetails | undefined =>
  structuredError?.safeDetails && typeof structuredError.safeDetails === 'object'
    ? (structuredError.safeDetails as IamRuntimeSafeDetails)
    : undefined;

const deriveFallbackRuntimeDiagnostics = (
  structuredError: Record<string, unknown> | undefined,
  status: number,
  code: string
) => {
  const rawDetails =
    structuredError?.details && typeof structuredError.details === 'object'
      ? (structuredError.details as Readonly<Record<string, unknown>>)
      : undefined;

  return deriveIamRuntimeDiagnostics({
    code,
    status,
    details: rawDetails,
  });
};

export const readRequestIdFromResponse = (response: Response, payload?: { requestId?: string }) =>
  payload?.requestId ?? response.headers.get('X-Request-Id') ?? undefined;

export const readErrorCodeFromPayload = (payload: IamErrorPayload | null): string | undefined => {
  if (!payload) {
    return undefined;
  }
  if (typeof payload.error === 'string') {
    return payload.error;
  }
  if (typeof payload.error === 'object' && payload.error && 'code' in payload.error) {
    const code = (payload.error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

export const readErrorMessageFromPayload = (payload: IamErrorPayload | null, status: number): string => {
  if (!payload) {
    return `http_${status}`;
  }
  if (typeof payload.error === 'object' && payload.error && 'message' in payload.error) {
    const message = (payload.error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  if (hasTopLevelMessage(payload) && typeof payload.message === 'string') {
    return payload.message;
  }
  return `http_${status}`;
};

export const readSafeDiagnosticDetails = (
  payload: IamErrorPayload | null
): IamRuntimeSafeDetails | undefined => {
  const source = readErrorDetailsRecord(payload);
  if (!source) {
    return undefined;
  }

  const safeDetails: IamRuntimeSafeDetails = {
    reason_code: readStringDetail(source, 'reason_code'),
    dependency: readStringDetail(source, 'dependency'),
    schema_object: readStringDetail(source, 'schema_object'),
    expected_migration: readStringDetail(source, 'expected_migration'),
    actor_resolution: readStringDetail(source, 'actor_resolution'),
    instance_id: readStringDetail(source, 'instance_id'),
    return_to: readStringDetail(source, 'return_to'),
    sync_state: readSyncState(source),
    sync_error_code: readSyncErrorCode(source),
  };

  return hasStringValues(safeDetails) ? safeDetails : undefined;
};

export const readRuntimeDiagnostics = (
  payload: IamErrorPayload | null,
  status: number,
  code: string,
  safeDetails: IamRuntimeSafeDetails | undefined
) => {
  const structuredError = readStructuredErrorPayload(payload);
  const fallbackDiagnostics = deriveFallbackRuntimeDiagnostics(structuredError, status, code);

  return {
    classification: normalizeRuntimeDiagnosticClassification(
      structuredError?.classification,
      fallbackDiagnostics.classification
    ),
    diagnosticStatus: normalizeRuntimeDiagnosticStatus(
      structuredError?.status,
      fallbackDiagnostics.status
    ),
    recommendedAction: normalizeRuntimeRecommendedAction(
      structuredError?.recommendedAction,
      fallbackDiagnostics.recommendedAction
    ),
    safeDetails:
      readExplicitSafeDetails(structuredError) ?? safeDetails ?? fallbackDiagnostics.safeDetails,
  };
};
