import { createHash } from 'node:crypto';
import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
} from '@sva/core';
import { jsonResponse } from '../shared/db-helpers.js';
import { readNumber, readString } from '../shared/input-readers.js';
import { z } from 'zod';

import { annotateApiErrorSpan } from './diagnostics.js';

export const createApiError = (
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
): Response => {
  annotateApiErrorSpan({ status, code, details });

  return jsonResponse(status, {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    ...(requestId ? { requestId } : {}),
  } satisfies ApiErrorResponse);
};

export const asApiItem = <T>(data: T, requestId?: string): ApiItemResponse<T> => ({
  data,
  ...(requestId ? { requestId } : {}),
});

export const asApiList = <T>(
  data: readonly T[],
  pagination: { page: number; pageSize: number; total: number },
  requestId?: string
): ApiListResponse<T> => ({
  data,
  pagination,
  ...(requestId ? { requestId } : {}),
});

export const parseRequestBody = async <T>(request: Request, schema: z.ZodSchema<T>) => {
  const raw = await request.text();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false as const, rawBody: raw };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false as const, rawBody: raw };
  }
  return { ok: true as const, data: parsed.data, rawBody: raw };
};

export const toPayloadHash = (rawBody: string): string =>
  createHash('sha256').update(rawBody).digest('hex');

export const readPage = (request: Request): { page: number; pageSize: number } => {
  const url = new URL(request.url);
  const page = Math.max(1, readNumber(Number(url.searchParams.get('page'))) ?? 1);
  const pageSize = Math.max(1, Math.min(100, readNumber(Number(url.searchParams.get('pageSize'))) ?? 25));
  return { page, pageSize };
};

export const readInstanceIdFromRequest = (request: Request, fallback?: string): string | undefined => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('instanceId')) ?? fallback;
};

export const readPathSegment = (request: Request, index: number): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0);
  return segments[index];
};

export const requireIdempotencyKey = (request: Request, requestId?: string): { key: string } | { error: Response } => {
  const idempotencyKey = readString(request.headers.get('idempotency-key'));
  if (!idempotencyKey) {
    return {
      error: createApiError(
        400,
        'idempotency_key_required',
        'Header Idempotency-Key ist erforderlich.',
        requestId
      ),
    };
  }
  return { key: idempotencyKey };
};
