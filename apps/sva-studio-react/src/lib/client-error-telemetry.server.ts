import { validateCsrf, withAuthenticatedUser } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

const TELEMETRY_PATH = '/api/v1/monitoring/client-errors';
const MAX_BODY_BYTES = 2_048;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const DEDUPE_WINDOW_MS = 5 * 60_000;
const MAX_SCOPES = 10_000;
const logger = createSdkLogger({ component: 'client-error-telemetry', level: 'info' });

const clientErrorSchema = z
  .object({
    clientEventId: z.string().uuid(),
    errorCode: z.enum([
      'client_unhandled_error',
      'client_unhandled_rejection',
    ]),
  })
  .strict();

const rateWindows = new Map<string, { readonly startedAt: number; count: number }>();
const acceptedEvents = new Map<string, number>();

const pruneExpiredEntries = (now: number): void => {
  for (const [key, bucket] of rateWindows) {
    if (now - bucket.startedAt < RATE_WINDOW_MS) break;
    rateWindows.delete(key);
  }
  for (const [key, expiresAt] of acceptedEvents) {
    if (expiresAt > now) break;
    acceptedEvents.delete(key);
  }
  while (rateWindows.size > MAX_SCOPES) {
    const oldestKey = rateWindows.keys().next().value;
    if (!oldestKey) break;
    rateWindows.delete(oldestKey);
  }
  while (acceptedEvents.size > MAX_SCOPES * RATE_LIMIT) {
    const oldestKey = acceptedEvents.keys().next().value;
    if (!oldestKey) break;
    acceptedEvents.delete(oldestKey);
  }
};

const consumeAccountBudget = (scopeKey: string, now: number): boolean => {
  const current = rateWindows.get(scopeKey);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(scopeKey, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
};

const readLimitedBody = async (request: Request): Promise<string | null> => {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};

const errorResponse = (status: number, code: string): Response => {
  const requestId = getWorkspaceContext().requestId;
  const headers = new Headers();
  if (requestId) headers.set('X-Request-Id', requestId);
  return Response.json(
    {
      error: { code },
      ...(requestId ? { requestId } : {}),
    },
    { status, ...(requestId ? { headers } : {}) }
  );
};

const dispatchClientErrorTelemetry = async (request: Request): Promise<Response | null> => {
  if (new URL(request.url).pathname !== TELEMETRY_PATH) return null;
  if (request.method !== 'POST') return errorResponse(405, 'method_not_allowed');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'unsupported_media_type');
  }

  return withAuthenticatedUser(request, async (ctx) => {
    const requestId = getWorkspaceContext().requestId;
    const csrfResponse = validateCsrf(request, requestId);
    if (csrfResponse) return csrfResponse;
    const instanceId = ctx.user.instanceId;
    if (!instanceId) return errorResponse(400, 'invalid_instance_id');

    const rawBody = await readLimitedBody(request);
    if (rawBody === null) return errorResponse(413, 'payload_too_large');
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, 'invalid_request');
    }
    const parsed = clientErrorSchema.safeParse(json);
    if (!parsed.success) return errorResponse(400, 'invalid_request');

    const now = Date.now();
    pruneExpiredEntries(now);
    const scopeKey = `${instanceId}:${ctx.user.id}`;
    if (!consumeAccountBudget(scopeKey, now)) return errorResponse(429, 'rate_limited');
    const eventKey = `${scopeKey}:${parsed.data.clientEventId}`;
    if (acceptedEvents.has(eventKey)) {
      return Response.json({ accepted: true, deduplicated: true });
    }
    acceptedEvents.set(eventKey, now + DEDUPE_WINDOW_MS);
    logger.warn('Studio browser reported an uncorrelated client error', {
      event: 'studio.client.error.reported',
      operation: 'client_error_report',
      request_id: requestId ?? 'unknown',
      client_event_id: parsed.data.clientEventId,
      error_code: parsed.data.errorCode,
    });
    return Response.json({ accepted: true, deduplicated: false });
  });
};

export const dispatchClientErrorTelemetryRequest = async (
  request: Request
): Promise<Response | null> => dispatchClientErrorTelemetry(request);
