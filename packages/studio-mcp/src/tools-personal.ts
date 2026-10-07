import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createStudioApiClient, StudioApiError } from './api-client.js';
import { resolveInterfaceSecret, type PersonalMcpContext, type StudioMcpConfig } from './config.js';
import { normalizeError } from './errors.js';
import { openLoginUrl } from './open-browser.js';
import { PersonalMcpAuthError, PersonalMcpContextManager } from './personal-auth.js';
import { redact } from './redaction.js';
import { result, type ToolResult } from './tools-support.js';
import { contextInput, requestInput, type PersonalRequest, validatePersonalRequest } from './tools-personal-request.js';

const secretReference = z.object({
  secretRef: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9:_./-]*$/u),
}).strict();

const interfaceSecretFields: Readonly<Record<string, readonly string[]>> = {
  s3: ['secretAccessKey'],
  supabase: ['databaseUrl', 'serviceRoleKey'],
  postgresql: ['databaseUrl'],
  mailTransport: ['password'],
  mapGeocoding: ['apiKey'],
};

const resolveInterfaceRequestBody = async (
  input: PersonalRequest,
  context: PersonalMcpContext,
  config: StudioMcpConfig
): Promise<Readonly<{ body?: Record<string, unknown>; error?: string }>> => {
  if (input.method !== 'POST' || input.path !== 'api/v1/interfaces') {
    return { ...(input.body ? { body: input.body } : {}) };
  }
  if (!input.body) return { error: 'mutation_body_required' };
  const body = JSON.parse(JSON.stringify(input.body)) as Record<string, unknown>;
  const draft = body.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { body };
  const draftRecord = draft as Record<string, unknown>;
  const fields = interfaceSecretFields[String(draftRecord.type)];
  const draftConfig = draftRecord.config;
  if (!fields || !draftConfig || typeof draftConfig !== 'object' || Array.isArray(draftConfig)) {
    return { body };
  }
  const configRecord = draftConfig as Record<string, unknown>;
  for (const field of fields) {
    const value = configRecord[field];
    if (typeof value === 'string' && value.length === 0) continue;
    const reference = secretReference.safeParse(value);
    if (!reference.success) return { error: 'interface_secret_reference_required' };
    try {
      configRecord[field] = await resolveInterfaceSecret(config, {
        contextId: context.id,
        interfaceType: String(draftRecord.type),
        ...(typeof body.existingId === 'string' ? { interfaceId: body.existingId } : {}),
        field,
        secretRef: reference.data.secretRef,
      });
    } catch (error) {
      const code = error instanceof Error && error.message.startsWith('interface_secret_')
        ? error.message
        : 'interface_secret_resolution_failed';
      return { error: code };
    }
  }
  return { body };
};

const localInterfaceSecretFailure = (code: string, requestId: string, contextId: string): ToolResult =>
  result({
    ok: false,
    error: {
      version: '1',
      code,
      category: code === 'interface_secret_reference_required' ? 'validation' : 'platform_readiness',
      retryable: false,
      retryClass: 'never',
      summary: code === 'interface_secret_reference_required'
        ? 'Interface-Secrets müssen über eine lokale Secret-Referenz bereitgestellt werden.'
        : 'Das lokale Auflösen eines Interface-Secrets ist fehlgeschlagen.',
      recommendedAction: code === 'interface_secret_resolver_not_configured'
        ? 'configure_local_interface_secret_resolver'
        : 'check_local_interface_secret_reference',
    },
    meta: { requestId, contextId },
  }, true);

const errorResult = (error: unknown, contextId?: string, extra: Record<string, unknown> = {}): ToolResult => {
  if (error instanceof PersonalMcpAuthError) {
    return result({
      ok: false,
      error: {
        version: '1',
        code: error.code,
        category: error.code.includes('login_required') || error.code.includes('authenticated') ? 'authentication' : 'validation',
        retryable: false,
        retryClass: 'never',
        summary: 'Der persönliche MCP-Kontext konnte nicht verwendet werden.',
        recommendedAction: 'personal_context_and_login_state_inspect',
      },
      meta: { ...(contextId ? { contextId } : {}), ...extra },
    }, true);
  }
  const normalized = normalizeError(error);
  return result({
    ok: false,
    error: normalized,
    meta: { ...(contextId ? { contextId } : {}), ...(normalized.requestId ? { requestId: normalized.requestId } : {}), ...extra },
  }, true);
};

const contextDescription = (context: PersonalMcpContext, account?: string) => {
  const issuerParts = new URL(context.issuer).pathname.split('/').filter(Boolean);
  return {
    id: context.id,
    name: context.name,
    kind: context.kind,
    host: new URL(context.baseUrl).host,
    realm: issuerParts[issuerParts.length - 1] ?? '',
    ...(context.kind === 'tenant' ? { tenantId: context.tenantId } : {}),
    ...(account ? { account } : {}),
  };
};

const personalRequestSuccess = (
  data: unknown,
  context: PersonalMcpContext,
  manager: PersonalMcpContextManager,
  requestId: string,
  idempotencyKey?: string
): ToolResult => {
  const session = manager.list().find((item) => item.id === context.id);
  return result({
    ok: true,
    data: redact(data),
    meta: {
      requestId,
      context: contextDescription(context, session?.account),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  });
};

const personalRequestFailure = (
  caught: unknown,
  input: PersonalRequest,
  context: PersonalMcpContext,
  manager: PersonalMcpContextManager,
  requestId: string,
  idempotencyKey?: string
): ToolResult => {
  if (caught instanceof PersonalMcpAuthError) return errorResult(caught, input.contextId, { requestId });
  const uncertain = input.method !== 'GET' && (!(caught instanceof StudioApiError) || caught.status >= 500);
  const normalized = normalizeError(caught);
  const session = manager.list().find((item) => item.id === context.id);
  return result({
    ok: false,
    error: normalized,
    ...(uncertain ? { mutationOutcome: 'unknown', nextStep: 'Read the affected resource before attempting another write.' } : {}),
    meta: {
      requestId: normalized.requestId ?? requestId,
      context: contextDescription(context, session?.account),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  }, true);
};

const requestUsers = async (
  input: PersonalRequest,
  config: StudioMcpConfig,
  manager: PersonalMcpContextManager,
  fetchImpl: typeof fetch
): Promise<ToolResult> => {
  const invalid = validatePersonalRequest(input);
  if (invalid) {
    return result({
      ok: false,
      error: { version: '1', code: invalid, category: 'validation', retryable: false, retryClass: 'never', summary: 'Der persönliche API-Aufruf ist außerhalb des freigegebenen Vertrags.', recommendedAction: 'personal_api_request_correct' },
      meta: { contextId: input.contextId },
    }, true);
  }
  let context: PersonalMcpContext;
  try {
    context = manager.getContext(input.contextId);
  } catch (caught) {
    return errorResult(caught, input.contextId);
  }
  const requestId = input.requestId ?? randomUUID();
  const idempotencyKey = input.method === 'GET' ? undefined : input.idempotencyKey ?? randomUUID();
  const resolvedBody = await resolveInterfaceRequestBody(input, context, config);
  if (resolvedBody.error) return localInterfaceSecretFailure(resolvedBody.error, requestId, context.id);
  const bodyText = resolvedBody.body === undefined ? undefined : JSON.stringify(resolvedBody.body);
  if (bodyText && Buffer.byteLength(bodyText, 'utf8') > 64 * 1024) {
    return result({
      ok: false,
      error: { version: '1', code: 'request_body_too_large', category: 'validation', retryable: false, retryClass: 'never', summary: 'Der Request-Body überschreitet das MCP-Limit.', recommendedAction: 'personal_api_request_reduce' },
      meta: { requestId, contextId: context.id },
    }, true);
  }
  const tokens = { getToken: () => manager.getAccessToken(context.id) };
  const client = createStudioApiClient(
    { baseUrl: context.baseUrl, readTimeoutMs: config.readTimeoutMs, mutationTimeoutMs: config.mutationTimeoutMs },
    tokens,
    fetchImpl,
    { retryUnauthorized: false, rejectRedirects: true }
  );
  try {
    const data = await client.request({
      method: input.method,
      path: input.path,
      ...(input.query ? { query: input.query } : {}),
      ...(resolvedBody.body ? { body: resolvedBody.body } : {}),
      requestId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    return personalRequestSuccess(data, context, manager, requestId, idempotencyKey);
  } catch (caught) {
    return personalRequestFailure(caught, input, context, manager, requestId, idempotencyKey);
  }
};

export const registerPersonalTools = (
  server: McpServer,
  config: StudioMcpConfig,
  manager: PersonalMcpContextManager,
  fetchImpl: typeof fetch
): void => {
  const outputSchema = {
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    mutationOutcome: z.string().optional(),
    nextStep: z.string().optional(),
    meta: z.record(z.string(), z.unknown()),
  };
  server.registerTool('studio_personal_contexts', {
    title: 'Persönliche Studio-Kontexte',
    description: 'Zeigt die lokal konfigurierten Plattform- und Tenant-Kontexte samt Host, Realm und angemeldetem Account.',
    inputSchema: {},
    outputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result({ ok: true, data: manager.list(), meta: {} }));

  server.registerTool('studio_personal_login', {
    title: 'Persönlich anmelden',
    description: 'Startet die PKCE-Anmeldung für genau einen vorkonfigurierten Realm-Kontext im lokalen Standardbrowser.',
    inputSchema: contextInput.shape,
    outputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (raw) => {
    const { contextId } = contextInput.parse(raw);
    try {
      const context = manager.getContext(contextId);
      const loginUrl = await manager.startLogin(contextId);
      try {
        await openLoginUrl(loginUrl);
      } catch {
        manager.cancelLogin(contextId);
        throw new PersonalMcpAuthError('login_callback_unavailable');
      }
      return result({ ok: true, data: { ...contextDescription(context), loginPending: true }, meta: {} });
    } catch (error) {
      return errorResult(error, contextId);
    }
  });

  server.registerTool('studio_personal_logout', {
    title: 'Persönlich abmelden',
    description: 'Entfernt die persönliche Anmeldung aus dem Arbeitsspeicher und widerruft nach Möglichkeit das Refresh-Token.',
    inputSchema: contextInput.shape,
    outputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (raw) => {
    const { contextId } = contextInput.parse(raw);
    try {
      await manager.logout(contextId);
      return result({ ok: true, data: { contextId, loggedOutLocally: true }, meta: {} });
    } catch (error) {
      return errorResult(error, contextId, { loggedOutLocally: true });
    }
  });

  server.registerTool('studio_personal_users_api', {
    title: 'Persönliche Verwaltungs-API aufrufen',
    description: 'Ruft freigegebene Admin-API-Routen im gewählten Kontext auf. Schnittstellen-Secrets werden ausschließlich über lokal aufgelöste Secret-Referenzen übergeben.',
    inputSchema: requestInput.shape,
    outputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async (raw) => {
    const parsed = requestInput.safeParse(raw);
    if (!parsed.success) return errorResult(new Error('personal_api_request_invalid'));
    return requestUsers(parsed.data, config, manager, fetchImpl);
  });
};
