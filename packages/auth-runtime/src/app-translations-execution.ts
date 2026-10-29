import {
  AppTranslationError,
  deepLTargetCode,
  readDeepLSettings,
  type CatalogScope,
  type AppTranslationLocale,
  type DeepLSetupStatus,
  type ExternalInterfaceRecord,
} from '@sva/core';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { withIamAppDb, type QueryClient } from './db.js';
import { getDeepLSetupStatus } from './app-translations-deepl.js';
import {
  startCatalogTranslation,
  catalogTranslationStatus,
  readCatalogTranslationJob,
} from './app-translations-jobs.js';
import {
  dispatch,
  projectGermanCatalog,
  projectTranslatedCatalog,
  type Operation,
} from './app-translations-operations.js';
import type { AuthenticatedRequestContext } from './middleware.js';
import { getSession } from './redis-session.js';
import { ensurePlatformAccess } from './iam-instance-registry/http.js';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';

const validMunicipalSession = (
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  ctx: AuthenticatedRequestContext,
  op: Operation
): boolean =>
  op.operation !== 'import' &&
  session.auth?.kind === 'instance' &&
  session.auth.instanceId === ctx.user.instanceId &&
  !!ctx.activeOrganizationId &&
  session.activeOrganizationId === ctx.activeOrganizationId;

export const authorizeCatalogOperation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  op: Operation,
  sourceOnly: boolean,
  action: string
) => {
  const session = await getSession(ctx.sessionId, { decryptTokens: false });
  if (!session || session.userId !== ctx.user.id)
    throw new AppTranslationError('catalog_forbidden');
  let scope: CatalogScope;
  let canManageInterfaces = false;
  if (session.auth?.kind === 'platform' && !ctx.user.instanceId) {
    // The existing Root administrator policy grants these explicit catalog actions.
    if (ensurePlatformAccess(request, { ...ctx, authKind: 'session' }))
      throw new AppTranslationError('catalog_forbidden');
    if (!sourceOnly) throw new AppTranslationError('catalog_forbidden');
    scope = { kind: 'global' };
  } else {
    if (
      !validMunicipalSession(session, ctx, op) ||
      session.auth?.kind !== 'instance' ||
      !ctx.activeOrganizationId
    )
      throw new AppTranslationError('catalog_forbidden');
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
    if (!permissions.ok) throw new Error('catalog_unavailable');
    canManageInterfaces = evaluateAuthorizeDecision(
      {
        instanceId: scope.instanceId,
        action: 'integration.manage',
        resource: { type: 'integration', organizationId: scope.organizationId },
        context: { organizationId: scope.organizationId },
      },
      permissions.permissions
    ).allowed;
    if (
      !evaluateAuthorizeDecision(
        {
          instanceId: scope.instanceId,
          action,
          resource: {
            type: sourceOnly ? 'app-texts' : 'app-translations',
            organizationId: scope.organizationId,
          },
          context: { organizationId: scope.organizationId },
        },
        permissions.permissions
      ).allowed
    )
      throw new AppTranslationError('catalog_forbidden');
  }
  const expectedScope = request.headers.get('x-sva-catalog-scope');
  if (expectedScope !== null && expectedScope !== JSON.stringify(scope))
    throw new AppTranslationError('catalog_conflict');
  if (scope.kind === 'municipal' && !sourceOnly) {
    const access = await readConfiguredPluginTenantAccess(scope.instanceId, 'app-translations');
    if (!access.allowed) throw new AppTranslationError('catalog_forbidden');
  }
  return { scope, canManageInterfaces };
};

const validateOperationLocales = async (
  op: Operation,
  sourceOnly: boolean,
  allowedLocales: readonly AppTranslationLocale[],
  repo: Awaited<ReturnType<typeof createAppTranslationRepository>>
) => {
  if (!sourceOnly && 'locale' in op && !allowedLocales.includes(op.locale))
    throw new AppTranslationError('catalog_forbidden');
  if (
    !sourceOnly &&
    'locales' in op &&
    op.locales &&
    op.locales.some((locale) => !allowedLocales.includes(locale))
  )
    throw new AppTranslationError('catalog_forbidden');
  if (!sourceOnly && op.operation === 'seal') {
    const draft = await repo.loadDraft(op.contractId);
    if (draft.supportedLocales.some((locale) => !allowedLocales.includes(locale)))
      throw new AppTranslationError('catalog_conflict');
  }
};

const readCatalogSetup = async (
  client: QueryClient,
  scope: CatalogScope,
  sourceOnly: boolean,
  isRead: boolean
) => {
  let setup: DeepLSetupStatus | undefined;
  let targetCodes: Record<string, string> = {};
  if (scope.kind === 'municipal' && !sourceOnly) {
    if (!isRead) {
      const module = await client.query(
        `SELECT m.module_id FROM iam.instance_modules m JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id WHERE m.instance_id=$1 AND m.module_id='app-translations' AND m.effective_active AND l.access_state='active' FOR SHARE OF m,l`,
        [scope.instanceId]
      );
      if (!module.rows[0]) throw new AppTranslationError('catalog_forbidden');
    }
    // Hold the saved configuration through mutation, so rotation or language changes cannot race a seal.
    const provider = await client.query<ExternalInterfaceRecord>(
      `SELECT id,type_key AS "typeKey",owner_kind AS "ownerKind",enabled,public_config_json AS "publicConfig",secret_config_ciphertext AS "secretConfigCiphertext",last_check_status AS "lastCheckStatus" FROM iam.instance_external_interfaces WHERE instance_id=$1 AND type_key='deepl' AND owner_kind='host' AND is_default ${isRead ? '' : 'FOR SHARE'}`,
      [scope.instanceId]
    );
    setup = getDeepLSetupStatus(provider.rows[0] ?? null);
    const settings = provider.rows[0]
      ? readDeepLSettings(provider.rows[0].publicConfig)
      : undefined;
    if (settings)
      targetCodes = Object.fromEntries(
        settings.selectedLocales.map((locale) => [
          locale,
          deepLTargetCode(locale, settings.englishVariant, settings.availableLanguages),
        ])
      );
    if (!isRead && !setup.ready) throw new AppTranslationError('catalog_setup_required');
  }
  return { setup, targetCodes };
};

export const runCatalogOperation = async (
  scope: CatalogScope,
  sourceOnly: boolean,
  isRead: boolean,
  op: Operation,
  actorId: string,
  canManageInterfaces: boolean
) =>
  withIamAppDb(async (client) => {
    if (scope.kind === 'municipal') {
      await client.query("SELECT set_config('app.instance_id', $1, true)", [scope.instanceId]);
      const active = await client.query(
        `SELECT o.id FROM iam.organizations o JOIN iam.instances i ON i.id = o.instance_id WHERE o.instance_id = $1 AND o.id = $2::uuid AND o.is_active AND i.status = 'active'`,
        [scope.instanceId, scope.organizationId]
      );
      if (!active.rows[0]) throw new AppTranslationError('catalog_forbidden');
    }
    const { setup, targetCodes } = await readCatalogSetup(client, scope, sourceOnly, isRead);
    const repo = await createAppTranslationRepository(client, scope);
    const allowedLocales: readonly AppTranslationLocale[] =
      sourceOnly || !setup ? ['de'] : ['de', ...setup.selectedLocales];
    await validateOperationLocales(op, sourceOnly, allowedLocales, repo);
    if (op.operation === 'translate' || op.operation === 'translationStatus') {
      if (scope.kind !== 'municipal' || sourceOnly)
        throw new AppTranslationError('catalog_forbidden');
      return op.operation === 'translate'
        ? startCatalogTranslation(client, scope, actorId, op)
        : catalogTranslationStatus(await readCatalogTranslationJob(client, scope, op.contractId));
    }
    if (op.operation === 'downloadTexts') {
      if (scope.kind !== 'municipal') throw new AppTranslationError('catalog_forbidden');
      return { download: await repo.exportTexts(op.releaseId) };
    }
    const value = await dispatch(repo, op, sourceOnly, allowedLocales, targetCodes);
    return sourceOnly
      ? projectGermanCatalog(value, op)
      : projectTranslatedCatalog(
          value,
          op,
          allowedLocales,
          targetCodes,
          setup,
          canManageInterfaces
        );
  });
