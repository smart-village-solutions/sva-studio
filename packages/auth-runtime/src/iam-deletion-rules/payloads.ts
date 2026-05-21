import type { IamDeletionContentStrategy } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { readNumber, readString } from '../shared/input-readers.js';

const CONTENT_STRATEGIES = new Set<IamDeletionContentStrategy>([
  'retain',
  'with_owner_lifecycle',
]);

export type TenantDeletionRulesPayload = {
  instanceId: string;
  deactivateAfterDays: number;
  pseudonymizeAfterDays: number;
  deleteAfterDays: number;
  defaultContentStrategy: IamDeletionContentStrategy;
  allowContentPreferenceOverride: boolean;
};

export type ContentPreferencePayload = {
  strategy?: IamDeletionContentStrategy;
};

const isContentStrategy = (value: string | undefined): value is IamDeletionContentStrategy =>
  typeof value === 'string' && CONTENT_STRATEGIES.has(value as IamDeletionContentStrategy);

const parsePositiveInteger = (value: unknown): number | undefined => {
  const parsed = readNumber(value);
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

export const parseTenantDeletionRulesPayload = async (
  request: Request
): Promise<{ ok: true; data: TenantDeletionRulesPayload } | { ok: false; response: Response }> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: createApiError(400, 'invalid_request', 'Ungültiger Request-Body.', getWorkspaceContext().requestId),
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      response: createApiError(400, 'invalid_request', 'Ungültiger Request-Body.', getWorkspaceContext().requestId),
    };
  }

  const record = body as Record<string, unknown>;
  const instanceId = readString(record.instanceId);
  const deactivateAfterDays = parsePositiveInteger(record.deactivateAfterDays);
  const pseudonymizeAfterDays = parsePositiveInteger(record.pseudonymizeAfterDays);
  const deleteAfterDays = parsePositiveInteger(record.deleteAfterDays);
  const defaultContentStrategy = readString(record.defaultContentStrategy);
  const allowContentPreferenceOverride =
    typeof record.allowContentPreferenceOverride === 'boolean'
      ? record.allowContentPreferenceOverride
      : undefined;

  if (
    !instanceId ||
    !deactivateAfterDays ||
    !pseudonymizeAfterDays ||
    !deleteAfterDays ||
    !isContentStrategy(defaultContentStrategy) ||
    typeof allowContentPreferenceOverride !== 'boolean'
  ) {
    return {
      ok: false,
      response: createApiError(
        400,
        'invalid_request',
        'Löschregeln konnten nicht validiert werden.',
        getWorkspaceContext().requestId
      ),
    };
  }

  if (pseudonymizeAfterDays <= deactivateAfterDays || deleteAfterDays <= pseudonymizeAfterDays) {
    return {
      ok: false,
      response: createApiError(
        400,
        'invalid_request',
        'Die Fristen müssen streng aufsteigend konfiguriert sein.',
        getWorkspaceContext().requestId
      ),
    };
  }

  return {
    ok: true,
    data: {
      instanceId,
      deactivateAfterDays,
      pseudonymizeAfterDays,
      deleteAfterDays,
      defaultContentStrategy,
      allowContentPreferenceOverride,
    },
  };
};

export const parseContentPreferencePayload = async (
  request: Request
): Promise<{ ok: true; data: ContentPreferencePayload } | { ok: false; response: Response }> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: createApiError(400, 'invalid_request', 'Ungültiger Request-Body.', getWorkspaceContext().requestId),
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      response: createApiError(400, 'invalid_request', 'Ungültiger Request-Body.', getWorkspaceContext().requestId),
    };
  }

  const strategy = readString((body as Record<string, unknown>).strategy);
  if (strategy !== undefined && !isContentStrategy(strategy)) {
    return {
      ok: false,
      response: createApiError(
        400,
        'invalid_request',
        'Die Inhaltsstrategie ist ungültig.',
        getWorkspaceContext().requestId
      ),
    };
  }

  return { ok: true, data: { strategy } };
};
