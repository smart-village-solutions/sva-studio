import { createSdkLogger } from '@sva/server-runtime';

import { buildLogContext } from '../../log-context.js';
import { asApiItem } from '../../shared/request-helpers.js';

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

export const toOptionalTrimmedSearchParam = (request: Request, key: string): string | undefined => {
  const value = new URL(request.url).searchParams.get(key)?.trim();
  return value ? value : undefined;
};

export const logWasteReadFailure = (
  operation: string,
  message: string,
  instanceId: string,
  error: unknown,
  details?: Readonly<Record<string, string | number | boolean | undefined>>
): void => {
  logger.error(message, {
    operation,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...details,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
};

export const createJsonApiItemResponse = (
  payload: unknown,
  requestId: string | undefined
): Response =>
  new Response(JSON.stringify(asApiItem(payload, requestId)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
