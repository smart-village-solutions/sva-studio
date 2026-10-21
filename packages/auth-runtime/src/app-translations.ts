/** Internal session facade. Deliberately not registered as an HTTP route. */
import { APP_TRANSLATION_LOCALES, AppTranslationError, type CatalogScope } from '@sva/core';
import {
  createAppTranslationRepository,
  type AppTranslationRepository,
} from '@sva/data-repositories/server';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';
import { withAuthenticatedUser } from './middleware.js';
import { getSession } from './redis-session.js';
import { validateCsrf } from './shared/request-security.js';
import { ensurePlatformAccess } from './iam-instance-registry/http.js';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import { withIamAppDb } from './db.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';
import { getAppTranslationsDeepLApiKey } from './runtime-secrets.js';

const logger = createSdkLogger({ component: 'app-translations' });
const contractId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const expectedRevision = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const locales = z.array(z.enum(APP_TRANSLATION_LOCALES)).min(1).max(APP_TRANSLATION_LOCALES.length);
const textFields = {
  contractId,
  expectedRevision,
  locale: z.enum(APP_TRANSLATION_LOCALES),
  key: z.string().min(1).max(128),
};
const operationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('read'), contractId }).strict(),
  z.object({ operation: z.literal('readRelease'), releaseId: z.uuid() }).strict(),
  z
    .object({ operation: z.literal('import'), manifest: z.unknown(), expectedRevision, locales })
    .strict(),
  z.object({ operation: z.literal('createMunicipal'), baseReleaseId: z.uuid(), locales }).strict(),
  z
    .object({
      operation: z.literal('changeBase'),
      contractId,
      expectedRevision,
      baseReleaseId: z.uuid(),
      locales,
    })
    .strict(),
  z
    .object({
      operation: z.literal('edit'),
      ...textFields,
      value: z.union([z.string().max(32768), z.array(z.string().max(32768)).min(1).max(100)]),
    })
    .strict(),
  z.object({ operation: z.literal('reset'), ...textFields }).strict(),
  z.object({ operation: z.literal('confirm'), ...textFields }).strict(),
  z.object({ operation: z.literal('seal'), contractId, expectedRevision }).strict(),
]);
type Operation = z.infer<typeof operationSchema>;
const actionFor = (op: Operation): string =>
  op.operation === 'import'
    ? 'app-translations.manifestImport'
    : ['read', 'readRelease'].includes(op.operation)
      ? 'app-translations.catalog.read'
      : op.operation === 'seal'
        ? 'app-translations.catalog.publish'
        : 'app-translations.catalog.write';
const dispatch = (repo: AppTranslationRepository, op: Operation) => {
  switch (op.operation) {
    case 'read':
      return repo.readEffective(op.contractId);
    case 'readRelease':
      return repo.loadRelease(op.releaseId);
    case 'import':
      return repo.importManifest(op.manifest, op.expectedRevision, op.locales);
    case 'createMunicipal':
      return repo.createMunicipalDraft(op.baseReleaseId, op.locales);
    case 'changeBase':
      return repo.changeBase(op.contractId, op.expectedRevision, op.baseReleaseId, op.locales);
    case 'edit':
      return repo.editText(op.contractId, op.expectedRevision, op.locale, op.key, op.value);
    case 'reset':
      return repo.resetOverride(op.contractId, op.expectedRevision, op.locale, op.key);
    case 'confirm':
      return repo.confirmCorrection(op.contractId, op.expectedRevision, op.locale, op.key);
    case 'seal':
      return repo.seal(op.contractId, op.expectedRevision);
  }
};
const response = (status: number, value: unknown) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

/** Scope comes only from the current stored session, never from operation payloads. */
export const executeAppTranslationOperation = (request: Request, raw: unknown): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const parsed = operationSchema.safeParse(raw);
    if (!parsed.success) return response(400, { error: 'invalid_catalog' });
    const op = parsed.data;
    const action = actionFor(op);
    const isRead = op.operation === 'read' || op.operation === 'readRelease';
    if (!isRead && request.method !== 'POST')
      return response(405, { error: 'invalid_catalog_method' });
    if (!isRead && validateCsrf(request)) return response(403, { error: 'catalog_forbidden' });
    try {
      const session = await getSession(ctx.sessionId, { decryptTokens: false });
      if (!session || session.userId !== ctx.user.id)
        return response(403, { error: 'catalog_forbidden' });
      let scope: CatalogScope;
      if (session.auth?.kind === 'platform' && !ctx.user.instanceId) {
        // The existing Root administrator policy grants these explicit catalog actions.
        if (ensurePlatformAccess(request, { ...ctx, authKind: 'session' }))
          return response(403, { error: 'catalog_forbidden' });
        scope = { kind: 'global' };
      } else {
        if (
          op.operation === 'import' ||
          session.auth?.kind !== 'instance' ||
          session.auth.instanceId !== ctx.user.instanceId ||
          !ctx.activeOrganizationId ||
          session.activeOrganizationId !== ctx.activeOrganizationId
        )
          return response(403, { error: 'catalog_forbidden' });
        scope = {
          kind: 'municipal',
          instanceId: session.auth.instanceId,
          organizationId: ctx.activeOrganizationId,
        };
        const permissions = await resolveEffectivePermissions({
          instanceId: scope.instanceId,
          keycloakSubject: ctx.user.id,
          organizationId: scope.organizationId,
        });
        if (!permissions.ok) return response(503, { error: 'catalog_unavailable' });
        if (
          !evaluateAuthorizeDecision(
            {
              instanceId: scope.instanceId,
              action,
              resource: { type: 'app-translations', organizationId: scope.organizationId },
              context: { organizationId: scope.organizationId },
            },
            permissions.permissions
          ).allowed
        )
          return response(403, { error: 'catalog_forbidden' });
      }
      if (scope.kind === 'municipal') {
        const access = await readConfiguredPluginTenantAccess(scope.instanceId, 'app-translations');
        if (!access.allowed) return response(403, { error: 'catalog_forbidden' });
      }
      const result = await withIamAppDb(async (client) => {
        if (scope.kind === 'municipal') {
          const active = await client.query(
            `SELECT o.id FROM iam.organizations o JOIN iam.instances i ON i.id = o.instance_id WHERE o.instance_id = $1 AND o.id = $2::uuid AND o.is_active AND i.status = 'active'`,
            [scope.instanceId, scope.organizationId]
          );
          if (!active.rows[0]) throw new AppTranslationError('catalog_forbidden');
        }
        const repo = await createAppTranslationRepository(client, scope);
        return dispatch(repo, op);
      });
      return response(200, { data: result });
    } catch (error) {
      if (error instanceof AppTranslationError) {
        const status =
          error.code === 'catalog_conflict'
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
        AND to_regclass('iam.app_translation_catalog_releases') IS NOT NULL AS ready`,
      [instanceId]
    );
    return result.rows[0]?.ready === true;
  });
  return { schemaReady, providerConfigured: Boolean(getAppTranslationsDeepLApiKey()) };
};
