import { mailTransportContract } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  deleteInstanceInterfaceForRequest,
  upsertInstanceInterfaceForRequest,
} from './interfaces-api';
import { listInstanceInterfaces } from './interfaces-api-list';
import { getErrorStatusCode } from './interfaces-api-transport';

const logger = createSdkLogger({ component: 'interfaces-api-http' });
const text = z.string().max(4096);
const base = z.object({ name: z.string().trim().min(1).max(120), enabled: z.boolean() });
const s3Draft = base
  .extend({
    type: z.literal('s3'),
    config: z
      .object({
        endpoint: text,
        region: text,
        bucket: text,
        accessKeyId: text,
        secretAccessKey: text,
        forcePathStyle: z.boolean(),
      })
      .strict(),
  })
  .strict();
const supabaseDraft = base
  .extend({
    type: z.literal('supabase'),
    config: z
      .object({
        projectUrl: text,
        schemaName: text,
        databaseUrl: text,
        serviceRoleKey: text,
      })
      .strict(),
  })
  .strict();
const postgresqlDraft = base
  .extend({
    type: z.literal('postgresql'),
    config: z.object({ schemaName: text, databaseUrl: text }).strict(),
  })
  .strict();
const mailTransportDraft = base
  .extend({
    type: z.literal('mailTransport'),
    config: z
      .object({
        transportId: text,
        host: text,
        port: text,
        securityMode: z.string().refine(mailTransportContract.isSecurityMode),
        authMode: z.string().refine(mailTransportContract.isAuthMode),
        username: text,
        defaultFromEmail: text,
        defaultFromName: text,
        defaultReplyToEmail: text,
        maxBatchSize: text,
        rateLimitPerMinute: text,
        password: text,
      })
      .strict(),
  })
  .strict();
const mapGeocodingDraft = base
  .extend({
    type: z.literal('mapGeocoding'),
    config: z
      .object({
        provider: z.enum(['geoapify', 'custom']),
        styleUrl: text,
        autocompleteEnabled: z.boolean(),
        geocodeEnabled: z.boolean(),
        reverseGeocodeEnabled: z.boolean(),
        suggestEndpoint: text,
        geocodeEndpoint: text,
        reverseGeocodeEndpoint: text,
        requestTimeoutMs: text,
        rateLimitPerMinute: text,
        killSwitchEnabled: z.boolean(),
        apiKey: text,
      })
      .strict(),
  })
  .strict();

const upsertInput = z
  .object({
    draft: z.discriminatedUnion('type', [
      s3Draft,
      supabaseDraft,
      postgresqlDraft,
      mailTransportDraft,
      mapGeocodingDraft,
    ]),
    existingId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u)
      .optional(),
  })
  .strict();

const readInterfaceId = (pathname: string): string | null => {
  const match = /^\/api\/v1\/interfaces\/([A-Za-z0-9_-]{1,128})$/u.exec(pathname);
  return match?.[1] ?? null;
};

const secretFieldsByType: Readonly<Record<string, readonly string[]>> = {
  s3: ['secretAccessKey'],
  supabase: ['databaseUrl', 'serviceRoleKey'],
  postgresql: ['databaseUrl'],
  mailTransport: ['password'],
  mapGeocoding: ['apiKey'],
};

const withoutSecrets = <T extends {
  readonly type?: string;
  readonly config?: unknown;
  readonly statusMessage?: unknown;
}>(entry: T) => {
  const { statusMessage: _statusMessage, ...safeEntry } = entry;
  const fields = entry.type ? secretFieldsByType[entry.type] : undefined;
  if (!fields || !entry.config || typeof entry.config !== 'object' || Array.isArray(entry.config)) {
    return safeEntry;
  }
  const config = { ...entry.config } as Record<string, unknown>;
  for (const field of fields) {
    if (typeof config[field] === 'string' && config[field] !== '') config[field] = '';
  }
  return { ...safeEntry, config };
};

const responseStatusFor = (error: unknown): number => {
  const explicit = getErrorStatusCode(error, 0);
  if (explicit >= 400) return explicit;
  const message = error instanceof Error ? error.message : '';
  if (message === 'unauthorized') return 401;
  if (message === 'forbidden' || message === 'permission_missing') return 403;
  if (message === 'interface_not_found') return 404;
  if (message.includes('conflict')) return 409;
  if (/^(invalid_|.*_invalid|.*_required|.*_not_supported)$/u.test(message)) return 400;
  return 500;
};

const errorResponse = (request: Request, error: unknown): Response => {
  const candidateCode =
    error instanceof Error ? (Reflect.get(error, 'code') ?? error.message) : undefined;
  const code =
    typeof candidateCode === 'string' && /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u.test(candidateCode)
      ? candidateCode
      : 'interface_request_failed';
  const status = responseStatusFor(error);
  logger.error('Interface API request failed', {
    operation: 'interface_api_request',
    request_id: getWorkspaceContext().requestId ?? null,
    method: request.method,
    route: new URL(request.url).pathname,
    status_code: status,
    error_code: code,
  });
  return Response.json({ error: { code } }, { status });
};

const handleList = async (request: Request): Promise<Response> => {
  try {
    const data = await listInstanceInterfaces(request, { includeMainserver: false });
    return Response.json({
      data: { ...data, entries: data.entries.map(withoutSecrets) },
    });
  } catch (error) {
    return errorResponse(request, error);
  }
};

const handleUpsert = async (request: Request): Promise<Response> => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
  }
  const parsed = upsertInput.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
  }
  try {
    const data = await upsertInstanceInterfaceForRequest(parsed.data, request);
    return Response.json({ data: withoutSecrets(data) });
  } catch (error) {
    return errorResponse(request, error);
  }
};

const handleDelete = async (request: Request, id: string): Promise<Response> => {
  try {
    const data = await deleteInstanceInterfaceForRequest({ id }, request);
    return Response.json({ data });
  } catch (error) {
    return errorResponse(request, error);
  }
};

export const dispatchInterfacesApiRequest = async (request: Request): Promise<Response | null> => {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/v1/interfaces') {
    if (request.method === 'GET') return handleList(request);
    if (request.method === 'POST') return handleUpsert(request);
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  }
  const interfaceId = readInterfaceId(pathname);
  if (!interfaceId) return null;
  if (request.method === 'DELETE') return handleDelete(request, interfaceId);
  return new Response(null, { status: 405, headers: { allow: 'DELETE' } });
};
