import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createStudioApiClient, StudioApiError } from './api-client.js';
import type { PersonalMcpContext, StudioMcpConfig } from './config.js';
import { normalizeError } from './errors.js';
import { openLoginUrl } from './open-browser.js';
import { PersonalMcpAuthError, PersonalMcpContextManager } from './personal-auth.js';
import { redact } from './redaction.js';
import { result, type ToolResult } from './tools-support.js';

const contextInput = z.object({ contextId: z.string().trim().min(1).max(64) });
const requestInput = z.object({
  contextId: z.string().trim().min(1).max(64),
  method: z.enum(['GET', 'POST']),
  path: z.string().trim().min(1).max(128),
  query: z.record(z.string().trim().min(1).max(64), z.union([
    z.string().max(500),
    z.array(z.string().max(500)).max(20),
  ])).optional(),
  body: z.record(z.string(), z.json()).optional(),
  requestId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
}).strict();

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

export const validatePersonalRequest = (input: z.infer<typeof requestInput>): string | undefined => {
  if (input.method !== 'GET' && input.method !== 'POST') return 'personal_method_not_allowed';
  if (input.path !== 'api/v1/iam/users') return 'personal_route_not_allowed';
  if (input.method === 'GET' && input.body !== undefined) return 'get_body_not_allowed';
  if (input.method === 'POST' && (!input.body || input.query !== undefined)) return 'post_contract_invalid';
  return validatePersonalQuery(input.query);
};

const validatePersonalQuery = (queryInput: z.infer<typeof requestInput>['query']): string | undefined => {
  const query = queryInput ?? {};
  if (Object.keys(query).length > 20) return 'query_limit_exceeded';
  const pageSizeValue = query.pageSize;
  if (pageSizeValue !== undefined) {
    const values = Array.isArray(pageSizeValue) ? pageSizeValue : [pageSizeValue];
    if (values.length !== 1 || !/^\d+$/u.test(values[0] ?? '') || Number(values[0]) > 100) {
      return 'page_size_out_of_range';
    }
  }
  return undefined;
};

const personalRequestSuccess = (
  data: unknown,
  input: z.infer<typeof requestInput>,
  context: PersonalMcpContext,
  manager: PersonalMcpContextManager,
  requestId: string
): ToolResult => {
  const session = manager.list().find((item) => item.id === context.id);
  return result({
    ok: true,
    data: redact(data),
    meta: {
      requestId,
      context: contextDescription(context, session?.account),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    },
  });
};

const personalRequestFailure = (
  caught: unknown,
  input: z.infer<typeof requestInput>,
  context: PersonalMcpContext,
  manager: PersonalMcpContextManager,
  requestId: string
): ToolResult => {
  if (caught instanceof PersonalMcpAuthError) return errorResult(caught, input.contextId, { requestId });
  const uncertain = input.method === 'POST' && (!(caught instanceof StudioApiError) || caught.status >= 500);
  const normalized = normalizeError(caught);
  const session = manager.list().find((item) => item.id === context.id);
  return result({
    ok: false,
    error: normalized,
    ...(uncertain ? { mutationOutcome: 'unknown', nextStep: 'Read the authorized user list before attempting another write.' } : {}),
    meta: {
      requestId: normalized.requestId ?? requestId,
      context: contextDescription(context, session?.account),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    },
  }, true);
};

const requestUsers = async (
  input: z.infer<typeof requestInput>,
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
  const bodyText = input.body === undefined ? undefined : JSON.stringify(input.body);
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
      ...(input.body ? { body: input.body } : {}),
      requestId,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
    return personalRequestSuccess(data, input, context, manager, requestId);
  } catch (caught) {
    return personalRequestFailure(caught, input, context, manager, requestId);
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
    title: 'User-Verwaltungs-API aufrufen',
    description: 'Ruft ausschließlich GET oder POST auf der freigegebenen User-Collection des ausdrücklich gewählten persönlichen Kontexts auf.',
    inputSchema: requestInput.shape,
    outputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (raw) => {
    const parsed = requestInput.safeParse(raw);
    if (!parsed.success) return errorResult(new Error('personal_api_request_invalid'));
    return requestUsers(parsed.data, config, manager, fetchImpl);
  });
};
