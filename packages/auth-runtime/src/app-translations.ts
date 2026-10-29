/** Session-authorized catalog operations and their local editor transport. */
import { AppTranslationError } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import { withAuthenticatedUser } from './middleware.js';
import { validateCsrf } from './shared/request-security.js';
import { withIamAppDb } from './db.js';
import { readDeepLSetupStatus } from './app-translations-deepl.js';
import { operationSchema, actionFor, type Operation } from './app-translations-operations.js';
import { authorizeCatalogOperation } from './app-translations-execution.js';
import { runCatalogOperation } from './app-translations-execution.js';
const logger = createSdkLogger({ component: 'app-translations' });
const response = (status: number, value: unknown) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

const forbiddenGermanOperation = (op: Operation): boolean =>
  ['translate', 'translationStatus', 'configureLocales', 'confirm'].includes(op.operation) ||
  ('locale' in op && op.locale !== 'de') ||
  ('locales' in op && !!op.locales && (op.locales.length !== 1 || op.locales[0] !== 'de'));
const forbiddenTranslationOperation = (op: Operation): boolean =>
  ['createMunicipal', 'changeBase'].includes(op.operation) ||
  ('locale' in op && op.locale === 'de');
const validateCatalogRequest = (request: Request, op: Operation) => {
  const headerMode = request.headers.get('x-sva-catalog-mode');
  const mode = op.operation === 'downloadTexts' ? (op.mode ?? headerMode) : headerMode;
  if (op.operation === 'downloadTexts' && op.mode && headerMode && op.mode !== headerMode)
    return response(400, { error: 'invalid_catalog' });
  if (mode !== null && !['source', 'translations'].includes(mode))
    return response(400, { error: 'invalid_catalog' });
  const sourceOnly = mode === 'source';
  if (sourceOnly ? forbiddenGermanOperation(op) : forbiddenTranslationOperation(op))
    return response(403, { error: 'catalog_forbidden' });
  const action = sourceOnly
    ? actionFor(op).replace('app-translations.', 'app-texts.')
    : actionFor(op);
  const isRead = ['overview', 'read', 'readRelease', 'downloadTexts', 'translationStatus'].includes(
    op.operation
  );
  if (!isRead && request.method !== 'POST')
    return response(405, { error: 'invalid_catalog_method' });
  if (!isRead && validateCsrf(request)) return response(403, { error: 'catalog_forbidden' });
  return { sourceOnly, action, isRead };
};

/** Scope comes only from the current stored session, never from operation payloads. */
export const executeAppTranslationOperation = (request: Request, raw: unknown): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const parsed = operationSchema.safeParse(raw);
    if (!parsed.success) return response(400, { error: 'invalid_catalog' });
    const op = parsed.data;
    const validated = validateCatalogRequest(request, op);
    if (validated instanceof Response) return validated;
    const { sourceOnly, action, isRead } = validated;
    try {
      const { scope, canManageInterfaces } = await authorizeCatalogOperation(
        request,
        ctx,
        op,
        sourceOnly,
        action
      );
      const result = await runCatalogOperation(
        scope,
        sourceOnly,
        isRead,
        op,
        ctx.user.id,
        canManageInterfaces
      );
      if (result && 'download' in result)
        return new Response(result.download, {
          headers: {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Content-Disposition': 'attachment; filename="texts.js"',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      return response(200, { data: result });
    } catch (error) {
      if (error instanceof AppTranslationError) {
        const status =
          error.code === 'catalog_setup_required'
            ? 409
            : error.code === 'catalog_conflict'
              ? 409
              : error.code === 'catalog_forbidden'
                ? 403
                : error.code === 'catalog_not_found'
                  ? 404
                  : 400;
        return response(status, { error: error.code });
      }
      logger.error('Internal catalog operation failed', {
        operation: action,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error: 'catalog_unavailable',
      });
      return response(503, { error: 'catalog_unavailable' });
    }
  });

/** Host-only local readiness; no provider request or remote catalog claim. */
export const readAppTranslationsLocalReadiness = async (
  instanceId: string
): Promise<{
  readonly schemaReady: boolean;
  readonly providerConfigured: boolean;
}> => {
  const schemaReady = await withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
    const result = await client.query<{ ready: boolean }>(
      `
      SELECT EXISTS(SELECT 1 FROM iam.instances WHERE id = $1 AND status = 'active')
        AND to_regclass('iam.app_translation_manifests') IS NOT NULL
        AND to_regclass('iam.app_translation_catalog_drafts') IS NOT NULL
        AND to_regclass('iam.app_translation_catalog_releases') IS NOT NULL
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='iam' AND table_name='app_translation_catalog_drafts' AND column_name='machine_standard_values_by_locale')
        AND EXISTS(SELECT 1 FROM iam.external_interface_types WHERE type_key='deepl') AS ready`,
      [instanceId]
    );
    return result.rows[0]?.ready === true;
  });
  return { schemaReady, providerConfigured: (await readDeepLSetupStatus(instanceId)).ready };
};

/** UI transport only; the session facade owns every operation's authorization. */
export const appTranslationCatalogHandler = async (request: Request): Promise<Response> => {
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    const operation = params.get('operation') ?? 'overview';
    if (
      !['overview', 'read', 'readRelease', 'downloadTexts', 'translationStatus'].includes(operation)
    )
      return response(405, { error: 'invalid_catalog_method' });
    return executeAppTranslationOperation(
      request,
      Object.fromEntries([
        ['operation', operation],
        ...[...params].filter(([key]) => key !== 'operation'),
      ])
    );
  }
  if (request.method !== 'POST') return response(405, { error: 'invalid_catalog_method' });
  if (validateCsrf(request) || !request.headers.has('x-sva-catalog-scope'))
    return response(403, { error: 'catalog_forbidden' });
  const body = await readBoundedCatalogBody(request);
  return body.ok ? executeAppTranslationOperation(request, body.data) : body.response;
};

export const readBoundedCatalogBody = async (request: Request, maxBytes = 1048576) => {
  // Bound streamed input before JSON parsing, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return { ok: false as const, response: response(400, { error: 'invalid_catalog' }) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false as const, response: response(413, { error: 'invalid_catalog' }) };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      ok: true as const,
      data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown,
    };
  } catch {
    return { ok: false as const, response: response(400, { error: 'invalid_catalog' }) };
  }
};
