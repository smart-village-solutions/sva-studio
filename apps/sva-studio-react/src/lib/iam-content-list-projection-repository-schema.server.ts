import type { MainserverContentType } from './iam-content-list-api.shared.js';
import {
  type ContentProjectionSyncTarget,
  type ProjectionDbClient,
  type ProjectionRefreshTrigger,
} from './iam-content-list-projection-model.server.js';
import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.server.js';

export type ProjectionSyncStateSchemaMode = 'legacy' | 'scoped';
export type ProjectionTableSchemaMode = 'legacy' | 'scoped';
type ProjectionSchemaModeCategory = 'sync-state' | 'table' | 'all';

const projectionSyncStateSchemaModes = new Map<string, ProjectionSyncStateSchemaMode>();
const projectionTableSchemaModes = new Map<string, ProjectionTableSchemaMode>();

export const resetProjectionRepositoryRuntimeState = (): void => {
  projectionSyncStateSchemaModes.clear();
  projectionTableSchemaModes.clear();
};
const clearProjectionSchemaModeCache = (
  instanceId: string,
  category: ProjectionSchemaModeCategory
): void => {
  if (category === 'sync-state' || category === 'all') {
    projectionSyncStateSchemaModes.delete(instanceId);
  }
  if (category === 'table' || category === 'all') {
    projectionTableSchemaModes.delete(instanceId);
  }
};

const isProjectionSchemaModeMismatchError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    column?: unknown;
    constraint?: unknown;
    message?: unknown;
  };
  const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
  const code = readString(candidate.code);
  const scopeReferences = [
    'projection_scope_key',
    'sync_scope_key',
    'content_list_projection_scope_key',
    'content_list_projection_sync_state_pkey',
  ];
  const diagnosticText = [candidate.column, candidate.constraint, candidate.message]
    .map(readString)
    .join(' ');

  return (
    ['42703', '42704', '42P10', '23502', '23505'].includes(code) &&
    scopeReferences.some((reference) => diagnosticText.includes(reference))
  );
};

export const withProjectionSchemaModeRetry = async <T>(
  target: ContentProjectionSyncTarget,
  category: ProjectionSchemaModeCategory,
  work: () => Promise<T>
): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (!isProjectionSchemaModeMismatchError(error)) {
      throw error;
    }

    clearProjectionSchemaModeCache(target.instanceId, category);
    return work();
  }
};

export const buildProjectionTargetKey = (target: ContentProjectionSyncTarget): string => {
  if (!target.actorAccountId) {
    throw new Error('mainserver_projection_scope_requires_actor_account_id');
  }

  return buildMainserverProjectionScopeKey({
    instanceId: target.instanceId,
    actorAccountId: target.actorAccountId,
    activeOrganizationId: target.organizationId,
    ...(target.actingPrincipalType ? { actingPrincipalType: target.actingPrincipalType } : {}),
    contentType: target.contentType,
  });
};

export const buildMainserverReadScopeKeys = (input: {
  readonly instanceId: string;
  readonly contentTypes: readonly string[];
  readonly actorAccountId: string | undefined;
  readonly activeOrganizationId: string | undefined;
}): readonly string[] => {
  if (!input.actorAccountId) {
    return [];
  }
  const actorAccountId = input.actorAccountId;

  return input.contentTypes
    .flatMap((contentType) => {
      const mainserverContentType = toMainserverContentType(contentType);
      if (!mainserverContentType) {
        return [];
      }

      const principalTypes = input.activeOrganizationId
        ? (['user', 'organization', undefined] as const)
        : (['user', undefined] as const);
      return principalTypes.map((actingPrincipalType) =>
        buildMainserverProjectionScopeKey({
          instanceId: input.instanceId,
          actorAccountId,
          activeOrganizationId: input.activeOrganizationId,
          ...(actingPrincipalType ? { actingPrincipalType } : {}),
          contentType: mainserverContentType,
        })
      );
    })
    .filter((value, index, values) => values.indexOf(value) === index);
};

export const buildMainserverSyncScopeKey = (target: ContentProjectionSyncTarget): string =>
  buildProjectionTargetKey(target);

export const loadProjectionSyncStateSchemaMode = async (
  client: ProjectionDbClient,
  instanceId: string
): Promise<ProjectionSyncStateSchemaMode> => {
  const cachedMode = projectionSyncStateSchemaModes.get(instanceId);
  if (cachedMode) {
    return cachedMode;
  }

  const result = await client.query<{ has_sync_scope_key?: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'iam'
    AND table_name = 'content_list_projection_sync_state'
    AND column_name = 'sync_scope_key'
) AS has_sync_scope_key;
    `
  );

  const mode = result.rows[0]?.has_sync_scope_key ? 'scoped' : 'legacy';
  projectionSyncStateSchemaModes.set(instanceId, mode);
  return mode;
};

export const loadProjectionTableSchemaMode = async (
  client: ProjectionDbClient,
  instanceId: string
): Promise<ProjectionTableSchemaMode> => {
  const cachedMode = projectionTableSchemaModes.get(instanceId);
  if (cachedMode) {
    return cachedMode;
  }

  const result = await client.query<{ has_projection_scope_key?: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'iam'
    AND table_name = 'content_list_projection'
    AND column_name = 'projection_scope_key'
) AS has_projection_scope_key;
    `
  );

  const mode = result.rows[0]?.has_projection_scope_key ? 'scoped' : 'legacy';
  projectionTableSchemaModes.set(instanceId, mode);
  return mode;
};

export const buildProjectionLogContext = (
  target: ContentProjectionSyncTarget,
  trigger: ProjectionRefreshTrigger
): Record<string, unknown> => ({
  actor_account_id: target.actorAccountId ?? null,
  content_type: target.contentType,
  instance_id: target.instanceId,
  keycloak_subject: target.keycloakSubject,
  organization_id: target.organizationId ?? null,
  projection_scope_key: buildProjectionTargetKey(target),
  refresh_trigger: trigger,
});

export const toMainserverContentType = (value: string): MainserverContentType | null => {
  if (
    value === 'news.article' ||
    value === 'events.event-record' ||
    value === 'poi.point-of-interest' ||
    value === 'generic-items.generic-item' ||
    value === 'faq.faq' ||
    value === 'cockpit-cards.cockpit-card' ||
    value === 'projects.project' ||
    value === 'surveys.survey'
  ) {
    return value;
  }

  return null;
};
