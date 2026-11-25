import { meilisearchInterfaceDraftSchema } from './instance-interface-meilisearch.js';
import { deepLInterfaceDraftSchema } from './instance-interfaces';
import { isValidInstanceId, mailTransportContract } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { dispatchRootMainserverInterfacesRequest } from '@sva/sva-mainserver/server';
import { z } from 'zod';

import {
  deleteInstanceInterfaceForRequest,
  upsertInstanceInterfaceForRequest,
} from './interfaces-api';
import { listInstanceInterfaces } from './interfaces-api-list';
import { dispatchMainserverSettingsRequest } from './interfaces-api-settings';
import { getErrorStatusCode, isClientValidationErrorMessage } from './interfaces-api-transport';

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
        provider: z.enum(['mapstick', 'geoapify', 'custom']),
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

const interfaceIdPattern = /^[A-Za-z0-9:_-]{1,128}$/u;

const upsertInput = z
  .object({
    draft: z.discriminatedUnion('type', [
      deepLInterfaceDraftSchema,
      meilisearchInterfaceDraftSchema,
      s3Draft,
      supabaseDraft,
      postgresqlDraft,
      mailTransportDraft,
      mapGeocodingDraft,
    ]),
    existingId: z.string().trim().regex(interfaceIdPattern).optional(),
  })
  .strict();

const readInterfaceId = (pathname: string): string | null => {
  const match = /^\/api\/v1\/interfaces\/([^/]{1,384})$/u.exec(pathname);
  if (!match?.[1]) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return interfaceIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
};

const secretFieldsByType: Readonly<Record<string, readonly string[]>> = {
  deepl: ['apiKey'],
  meilisearch: ['apiKey'],
  s3: ['secretAccessKey'],
  supabase: ['databaseUrl', 'serviceRoleKey'],
  postgresql: ['databaseUrl'],
  mailTransport: ['password'],
  mapGeocoding: ['apiKey'],
};

const withoutSecrets = <
  T extends {
    readonly type?: string;
    readonly config?: unknown;
    readonly statusMessage?: unknown;
  },
>(
  entry: T
) => {
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
  if (
    message === 'forbidden' ||
    message === 'permission_missing' ||
    message === 'meilisearch_requires_search_module'
  )
    return 403;
  if (message === 'interface_not_found') return 404;
  if (
    message.includes('conflict') ||
    message === 'meilisearch_already_configured' ||
    message === 'meilisearch_disable_before_cutover'
  )
    return 409;
  if (message.startsWith('meilisearch_')) return 400;
  if (isClientValidationErrorMessage(message)) return 400;
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

const rootMeilisearchPath = /^\/api\/v1\/iam\/instances\/([^/]+)\/meilisearch-interface$/u;

const updateRootMeilisearch = async (request: Request, instanceId: string, existingId?: string) => {
  const parsed = meilisearchInterfaceDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  const { upsertStoredInterface } = await import('./instance-interfaces-server.js');
  return upsertStoredInterface(instanceId, parsed.data, existingId);
};

const withRootMeilisearch = async (request: Request, instanceId: string): Promise<Response> => {
  if (!isValidInstanceId(instanceId))
    return Response.json({ error: { code: 'invalid_instance_id' } }, { status: 400 });
  if (request.method !== 'GET' && request.method !== 'PUT')
    return new Response(null, { status: 405, headers: { allow: 'GET, PUT' } });
  // This route belongs to the Root UI. Existing service grants do not confer this capability.
  if (request.headers.has('authorization'))
    return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const { withRootInstanceInterfaceRegistryAccess } = await import('@sva/auth-runtime/server');
  return withRootInstanceInterfaceRegistryAccess(
    request,
    request.method === 'PUT' ? 'instance.update' : 'instance.read',
    async (access) => {
      try {
        const { loadDefaultExternalInterfaceRecord, loadInstanceById } =
          await import('@sva/data-repositories/server');
        const instance = await loadInstanceById(instanceId);
        if (instance?.status !== 'active')
          return Response.json({ error: { code: 'instance_not_found' } }, { status: 404 });
        if (!instance.assignedModules.includes('search'))
          throw new Error('meilisearch_requires_search_module');

        const existing = await loadDefaultExternalInterfaceRecord(instanceId, 'meilisearch');
        const { mapRecordToStoredEntry } =
          await import('./instance-interface-record-mapping.server.js');
        const { projectStoredEntry } = await import('./interfaces-api-list.js');
        const entry =
          request.method === 'GET'
            ? existing?.ownerKind === 'host'
              ? mapRecordToStoredEntry(existing)
              : null
            : await updateRootMeilisearch(request, instanceId, existing?.id);

        if (request.method === 'PUT') {
          if (!entry) return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
          await access.recordSave(instanceId, entry.enabled);
        }
        return Response.json(
          { data: entry ? withoutSecrets(await projectStoredEntry(instanceId, entry)) : null },
          { headers: { 'Cache-Control': 'private, no-store' } }
        );
      } catch (error) {
        return errorResponse(request, error);
      }
    },
    'meilisearch_interface'
  );
};

export const dispatchInterfacesApiRequest = async (request: Request): Promise<Response | null> => {
  const { pathname } = new URL(request.url);
  const meilisearchInstanceId = rootMeilisearchPath.exec(pathname)?.[1];
  if (meilisearchInstanceId) return withRootMeilisearch(request, meilisearchInstanceId);
  if (
    pathname === '/api/v1/iam/instances/mainserver-interfaces' ||
    /^\/api\/v1\/iam\/instances\/[^/]+\/mainserver-interface$/u.test(pathname)
  ) {
    return dispatchRootMainserverInterfacesRequest(request);
  }
  if (pathname === '/api/v1/interfaces/mainserver') {
    try {
      return await dispatchMainserverSettingsRequest(request);
    } catch (error) {
      return errorResponse(request, error);
    }
  }
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
