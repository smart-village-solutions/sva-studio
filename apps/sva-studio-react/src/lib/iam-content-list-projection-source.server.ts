import {
  loadCurrentMainserverDataProviderBinding,
  readEffectiveSvaMainserverCredentialsWithStatus,
  readMainserverScopeResolverMode,
} from '@sva/auth-runtime/server';
import type { IamContentListItem } from '@sva/core';
import { resolveMainserverGenericItemContentType } from '@sva/plugin-sdk';
import { createSdkLogger } from '@sva/server-runtime';
import type { SvaMainserverProjectionListItem } from '@sva/sva-mainserver';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
  getSvaMainserverSurvey,
  listSvaMainserverEvents,
  listSvaMainserverGenericItems,
  listSvaMainserverNews,
  listSvaMainserverPoi,
  listSvaMainserverProjection,
  listSvaMainserverSurveys,
} from '@sva/sva-mainserver/server';

import {
  mapEventItem,
  mapGenericItem,
  mapNewsItem,
  mapPoiItem,
  mapSurveyItem,
} from './iam-content-list-mainserver.js';
import {
  createListErrorResponse,
  type MainserverContentType,
} from './iam-content-list-api.shared.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
  TargetedMutationContentType,
} from './iam-content-list-projection-model.server.js';
import { buildProjectionLogContext } from './iam-content-list-projection-repository.server.js';
import {
  studioMainserverGenericTypeOwnership,
  studioMainserverGenericTypeRegistry,
} from './mainserver-generic-type-registry.server.js';

const MAX_SYNC_ITEMS_PER_TYPE = 5_000;
const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'info',
});

export const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item' as const;
export const registeredGenericItemContentTypes = new Set<string>(
  studioMainserverGenericTypeRegistry.values()
);
export const resolveGenericItemProjectionContentType = (genericType: string): string =>
  resolveMainserverGenericItemContentType(
    studioMainserverGenericTypeRegistry,
    genericType,
    GENERIC_ITEMS_CONTENT_TYPE
  );
type MainserverProjectionLoadedPage = Readonly<{
  readonly rows: readonly MainserverProjectionRowInput[];
  readonly hasNextPage: boolean;
  readonly nextPage: number;
  readonly nextGenericItemScanOffset?: number;
  readonly skippedInvalidCount: number;
}>;

type MainserverProjectionPageResult<TItem> = {
  readonly credentialSource?: IamContentListItem['credentialSource'];
  readonly data: readonly TItem[];
  readonly pagination: {
    readonly hasNextPage: boolean;
    readonly page?: number;
    readonly nextGenericItemScanOffset?: number;
  };
};

const resolveMainserverProjectionCredentialSource = <TItem>(
  result: MainserverProjectionPageResult<TItem>,
  actingPrincipalType?: 'organization' | 'user'
): IamContentListItem['credentialSource'] =>
  result.credentialSource ?? actingPrincipalType ?? 'user';

const hasNextProjectionPage = (
  result: MainserverProjectionPageResult<unknown>,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  },
  continueAfterEmptyPage = true
): boolean => {
  const nextPage = result.pagination.page ?? pageQuery.page;
  return (
    (continueAfterEmptyPage || result.data.length > 0) &&
    nextPage >= pageQuery.page &&
    result.pagination.hasNextPage &&
    pageQuery.page * pageQuery.pageSize < MAX_SYNC_ITEMS_PER_TYPE
  );
};

const buildLoadedProjectionPage = <TItem>(input: {
  readonly result: MainserverProjectionPageResult<TItem>;
  readonly pagingResult?: MainserverProjectionPageResult<unknown>;
  readonly pageQuery: {
    readonly page: number;
    readonly pageSize: number;
  };
  readonly mapRow: (
    item: TItem,
    credentialSource: IamContentListItem['credentialSource']
  ) => MainserverProjectionRowInput;
  readonly projectedOrganizationId: string | undefined;
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly continueAfterEmptyPage?: boolean;
}): MainserverProjectionLoadedPage => {
  const credentialSource = resolveMainserverProjectionCredentialSource(
    input.result,
    input.actingPrincipalType
  );
  const pagingResult = input.pagingResult ?? input.result;
  const nextPage = pagingResult.pagination.page ?? input.pageQuery.page;

  return {
    rows: input.result.data.map((item) => input.mapRow(item, credentialSource)),
    hasNextPage: hasNextProjectionPage(pagingResult, input.pageQuery, input.continueAfterEmptyPage),
    nextPage: nextPage + 1,
    skippedInvalidCount: 0,
  };
};

type MainserverProjectionPageLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    pageQuery: {
      readonly page: number;
      readonly pageSize: number;
    };
  }>
) => Promise<MainserverProjectionLoadedPage>;

const toProjectionPrincipalContext = (target: ContentProjectionSyncTarget) =>
  target.actingPrincipalType ? { actingPrincipalType: target.actingPrincipalType } : {};

const createGenericItemPageLoader =
  (options: {
    readonly overrideContentType: boolean;
    readonly continueAfterEmptyPage?: boolean;
  }): MainserverProjectionPageLoader =>
  async ({ target, pageQuery }) => {
    const result = await listSvaMainserverGenericItems({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      includeInvisible: true,
      ...pageQuery,
    });
    const projectedItems = result.data.filter(
      (item) => resolveGenericItemProjectionContentType(item.genericType) === target.contentType
    );

    return buildLoadedProjectionPage({
      result: { ...result, data: projectedItems },
      pagingResult: result,
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapGenericItem(item, target.instanceId, []),
        ...(options.overrideContentType ? { contentType: target.contentType } : {}),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: target.contentType,
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      ...(options.continueAfterEmptyPage ? { continueAfterEmptyPage: true } : {}),
    });
  };

const mainserverProjectionPageLoaders: Record<
  MainserverContentType,
  MainserverProjectionPageLoader
> = {
  'events.event-record': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverEvents({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapEventItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'events.event-record',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'generic-items.generic-item': createGenericItemPageLoader({ overrideContentType: false }),
  'faq.faq': createGenericItemPageLoader({ overrideContentType: true }),
  'cockpit-cards.cockpit-card': createGenericItemPageLoader({ overrideContentType: true }),
  'projects.project': createGenericItemPageLoader({
    overrideContentType: true,
    continueAfterEmptyPage: true,
  }),
  'news.article': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverNews({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        orderBy: 'updatedAt_DESC',
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapNewsItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'news.article',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'poi.point-of-interest': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverPoi({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeInvisible: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapPoiItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'poi.point-of-interest',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
  'surveys.survey': async ({ target, pageQuery }) =>
    buildLoadedProjectionPage({
      result: await listSvaMainserverSurveys({
        instanceId: target.instanceId,
        keycloakSubject: target.keycloakSubject,
        activeOrganizationId: target.organizationId,
        ...toProjectionPrincipalContext(target),
        includeArchived: true,
        ...pageQuery,
      }),
      pageQuery,
      mapRow: (item, credentialSource) => ({
        ...mapSurveyItem(item, target.instanceId, []),
        ...(target.organizationId ? { organizationId: target.organizationId } : {}),
        credentialSource,
        sourceEntityType: 'surveys.survey',
        sourceEntityId: item.id,
      }),
      projectedOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
    }),
};

type ProjectionBindingState = Readonly<{
  authorizationMode: 'credential_visible_compatibility' | 'exact';
  userDataProviderId?: string;
  organizationDataProviderId?: string;
  userCredentialFingerprint?: string;
  organizationCredentialFingerprint?: string;
}>;

const loadProjectionCredentials = async (target: ContentProjectionSyncTarget) =>
  Promise.all([
    readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      actingPrincipalType: 'user',
    }),
    target.organizationId
      ? readEffectiveSvaMainserverCredentialsWithStatus({
          instanceId: target.instanceId,
          keycloakSubject: target.keycloakSubject,
          activeOrganizationId: target.organizationId,
          actingPrincipalType: 'organization',
        })
      : Promise.resolve(undefined),
  ]);

type ProjectionCredentials = Awaited<ReturnType<typeof loadProjectionCredentials>>;

const loadProjectionBinding = async (
  target: ContentProjectionSyncTarget,
  principalType: 'user' | 'organization',
  principalId: string | undefined,
  credentials: ProjectionCredentials[number]
) => {
  if (!principalId || credentials?.status !== 'ok') return undefined;
  return loadCurrentMainserverDataProviderBinding({
    instanceId: target.instanceId,
    principalType,
    principalId,
    credentialFingerprint: credentials.credentialFingerprint,
  });
};

const readBindingDataProviderId = (
  binding: Awaited<ReturnType<typeof loadProjectionBinding>>
): string | undefined => binding?.dataProviderId;

const readCredentialFingerprint = (
  credentials: ProjectionCredentials[number]
): string | undefined =>
  credentials?.status === 'ok' ? credentials.credentialFingerprint : undefined;

const deriveProjectionBindingState = (
  target: ContentProjectionSyncTarget,
  credentials: ProjectionCredentials,
  bindings: Awaited<ReturnType<typeof loadProjectionBinding>>[]
): ProjectionBindingState => {
  const [userCredentials, organizationCredentials] = credentials;
  const [userBinding, organizationBinding] = bindings;
  const hasRequiredBindings = target.organizationId
    ? Boolean(userBinding && organizationBinding)
    : Boolean(userBinding);
  const authorizationMode =
    readMainserverScopeResolverMode() === 'automatic' && hasRequiredBindings
      ? 'exact'
      : 'credential_visible_compatibility';
  const bindingMetadata = Object.fromEntries(
    Object.entries({
      userDataProviderId: readBindingDataProviderId(userBinding),
      organizationDataProviderId: readBindingDataProviderId(organizationBinding),
      userCredentialFingerprint: readCredentialFingerprint(userCredentials),
      organizationCredentialFingerprint: readCredentialFingerprint(organizationCredentials),
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  ) as Omit<ProjectionBindingState, 'authorizationMode'>;

  return {
    authorizationMode,
    ...bindingMetadata,
  };
};

const resolveProjectionBindingState = async (
  target: ContentProjectionSyncTarget
): Promise<ProjectionBindingState> => {
  if (!target.actorAccountId) {
    return { authorizationMode: 'credential_visible_compatibility' };
  }

  try {
    const credentials = await loadProjectionCredentials(target);
    const bindings = await Promise.all([
      loadProjectionBinding(target, 'user', target.actorAccountId, credentials[0]),
      loadProjectionBinding(target, 'organization', target.organizationId, credentials[1]),
    ]);
    return deriveProjectionBindingState(target, credentials, bindings);
  } catch (error) {
    contentProjectionLogger.warn('mainserver_projection_binding_state_failed', {
      operation: 'mainserver_projection_binding_state',
      instance_id: target.instanceId,
      content_type: target.contentType,
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
    return { authorizationMode: 'credential_visible_compatibility' };
  }
};

const enrichProjectionRowsWithBindingState = async (
  target: ContentProjectionSyncTarget,
  page: MainserverProjectionLoadedPage
): Promise<MainserverProjectionLoadedPage> => {
  const state = await resolveProjectionBindingState(target);
  return {
    ...page,
    rows: page.rows.map((row) => {
      const providerId = row.sourceDataProviderId;
      const exact = state.authorizationMode === 'exact';
      return {
        ...row,
        ownerUserId:
          exact && providerId === state.userDataProviderId ? target.actorAccountId : undefined,
        ownerOrganizationId:
          exact && providerId === state.organizationDataProviderId
            ? target.organizationId
            : undefined,
        credentialFingerprint:
          row.credentialSource === 'organization'
            ? state.organizationCredentialFingerprint
            : state.userCredentialFingerprint,
        authorizationMode: state.authorizationMode,
      };
    }),
  };
};

const resolveSlimProjectionStatus = (
  item: SvaMainserverProjectionListItem
): MainserverProjectionRowInput['status'] => {
  if (item.visible === false || item.active === false || item.status === 'DRAFT') return 'draft';
  return item.status === 'ARCHIVED' ? 'archived' : 'published';
};

const optionalProjectionField = <TKey extends string, TValue>(
  key: TKey,
  value: TValue | null | undefined
): Partial<Record<TKey, TValue>> =>
  (value == null ? {} : { [key]: value }) as Partial<Record<TKey, TValue>>;

const projectionValueOrFallback = (value: string | null | undefined, fallback: string): string =>
  value ?? fallback;

const readProjectionDataProviderField = (
  item: SvaMainserverProjectionListItem,
  field: 'id' | 'name'
): string | undefined => item.dataProvider?.[field];

const mapSlimProjectionRow = (
  target: ContentProjectionSyncTarget,
  credentialSource: IamContentListItem['credentialSource'],
  item: SvaMainserverProjectionListItem
): MainserverProjectionRowInput => ({
  id: item.id,
  instanceId: target.instanceId,
  ...optionalProjectionField('organizationId', target.organizationId),
  contentType: target.contentType,
  title: item.title,
  ...optionalProjectionField('publishedAt', item.publishedAt),
  createdAt: item.createdAt,
  createdBy: projectionValueOrFallback(item.author, 'mainserver'),
  updatedAt: item.updatedAt,
  updatedBy: projectionValueOrFallback(item.author, 'mainserver'),
  authorDisplayMode: 'organization',
  author: projectionValueOrFallback(item.author, 'mainserver'),
  ...optionalProjectionField('sourceDataProviderId', readProjectionDataProviderField(item, 'id')),
  ...optionalProjectionField(
    'sourceDataProviderName',
    readProjectionDataProviderField(item, 'name')
  ),
  credentialSource,
  payload: {},
  status: resolveSlimProjectionStatus(item),
  validationState: 'valid',
  historyRef: `mainserver:${target.contentType}:${item.id}`,
  sourceEntityType: target.contentType,
  sourceEntityId: item.id,
});

export const loadMainserverProjectionPage = async (
  target: ContentProjectionSyncTarget,
  pageQuery: {
    readonly page: number;
    readonly pageSize: number;
    readonly genericItemScanOffset?: number;
  }
): Promise<MainserverProjectionLoadedPage> => {
  if (!target.instanceId) {
    throw createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.'
    );
  }
  if ((process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE ?? 'slim') !== 'legacy') {
    const result = await listSvaMainserverProjection({
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      activeOrganizationId: target.organizationId,
      ...toProjectionPrincipalContext(target),
      contentType: target.contentType,
      genericTypeOwnership: studioMainserverGenericTypeOwnership,
      includeInvisible: true,
      ...pageQuery,
    });
    const credentialSource = result.credentialSource ?? target.actingPrincipalType ?? 'user';
    return enrichProjectionRowsWithBindingState(target, {
      rows: result.data.map((item: SvaMainserverProjectionListItem) =>
        mapSlimProjectionRow(target, credentialSource, item)
      ),
      hasNextPage: hasNextProjectionPage(
        result,
        pageQuery,
        target.contentType === GENERIC_ITEMS_CONTENT_TYPE ||
          registeredGenericItemContentTypes.has(target.contentType)
      ),
      nextPage: (result.pagination.page ?? pageQuery.page) + 1,
      ...(result.pagination.nextGenericItemScanOffset !== undefined
        ? { nextGenericItemScanOffset: result.pagination.nextGenericItemScanOffset }
        : {}),
      skippedInvalidCount: result.skippedInvalidCount,
    });
  }
  return enrichProjectionRowsWithBindingState(
    target,
    await mainserverProjectionPageLoaders[target.contentType]({
      target,
      pageQuery,
    })
  );
};

type MainserverMutationProjectionLoader = (
  input: Readonly<{
    target: ContentProjectionSyncTarget;
    entityId: string;
    credentialSource: IamContentListItem['credentialSource'];
    projectedOrganizationId: string | undefined;
  }>
) => Promise<MainserverProjectionRowInput>;

export const requireMutationProjectionPrincipalContext = (
  target: ContentProjectionSyncTarget
): Readonly<{
  actingPrincipalType: 'organization' | 'user';
  credentialFingerprint: string;
  authorizationMode: 'credential_visible_compatibility' | 'exact';
}> => {
  if (!target.actingPrincipalType || !target.credentialFingerprint || !target.authorizationMode) {
    throw new Error('mainserver_projection_mutation_principal_context_required');
  }
  return {
    actingPrincipalType: target.actingPrincipalType,
    credentialFingerprint: target.credentialFingerprint,
    authorizationMode: target.authorizationMode,
  };
};

export const toMutationProjectionConnectionContext = (target: ContentProjectionSyncTarget) => {
  const context = requireMutationProjectionPrincipalContext(target);
  return {
    actingPrincipalType: context.actingPrincipalType,
    credentialFingerprint: context.credentialFingerprint,
  } as const;
};

const createGenericItemMutationLoader =
  (
    contentType: Extract<
      TargetedMutationContentType,
      'generic-items.generic-item' | 'faq.faq' | 'cockpit-cards.cockpit-card' | 'projects.project'
    >,
    overrideContentType: boolean
  ): MainserverMutationProjectionLoader =>
  async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverGenericItem({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      genericItemId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapGenericItem(item, target.instanceId, []),
      ...(overrideContentType ? { contentType } : {}),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: contentType,
      sourceEntityId: item.id,
    };
  };

export const mainserverMutationProjectionLoaders: Record<
  TargetedMutationContentType,
  MainserverMutationProjectionLoader
> = {
  'events.event-record': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverEvent({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      eventId: entityId,
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
    });
    return {
      ...mapEventItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'events.event-record',
      sourceEntityId: item.id,
    };
  },
  'generic-items.generic-item': createGenericItemMutationLoader(
    'generic-items.generic-item',
    false
  ),
  'faq.faq': createGenericItemMutationLoader('faq.faq', true),
  'cockpit-cards.cockpit-card': createGenericItemMutationLoader('cockpit-cards.cockpit-card', true),
  'projects.project': createGenericItemMutationLoader('projects.project', true),
  'news.article': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverNews({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      newsId: entityId,
    });
    return {
      ...mapNewsItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'news.article',
      sourceEntityId: item.id,
    };
  },
  'poi.point-of-interest': async ({
    target,
    entityId,
    credentialSource,
    projectedOrganizationId,
  }) => {
    const item = await getSvaMainserverPoi({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      poiId: entityId,
    });
    return {
      ...mapPoiItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'poi.point-of-interest',
      sourceEntityId: item.id,
    };
  },
  'surveys.survey': async ({ target, entityId, credentialSource, projectedOrganizationId }) => {
    const item = await getSvaMainserverSurvey({
      activeOrganizationId: target.organizationId,
      ...toMutationProjectionConnectionContext(target),
      instanceId: target.instanceId,
      keycloakSubject: target.keycloakSubject,
      surveyId: entityId,
    });
    return {
      ...mapSurveyItem(item, target.instanceId, []),
      ...(projectedOrganizationId ? { organizationId: projectedOrganizationId } : {}),
      credentialSource,
      sourceEntityType: 'surveys.survey',
      sourceEntityId: item.id,
    };
  },
};

export const loadMainserverProjectionMutationRow = async (
  target: ContentProjectionSyncTarget,
  entityId: string
): Promise<MainserverProjectionRowInput> => {
  const projectedOrganizationId = target.organizationId;
  const principalContext = requireMutationProjectionPrincipalContext(target);
  const credentialSource: IamContentListItem['credentialSource'] =
    principalContext.actingPrincipalType;
  const loader =
    mainserverMutationProjectionLoaders[target.contentType as TargetedMutationContentType];
  if (loader) {
    const row = await loader({
      target,
      entityId,
      credentialSource,
      projectedOrganizationId,
    });
    return {
      ...row,
      credentialSource,
      credentialFingerprint: principalContext.credentialFingerprint,
      authorizationMode: principalContext.authorizationMode,
    };
  }

  throw new Error(
    `Unsupported targeted projection refresh for content type "${target.contentType}".`
  );
};

export const enrichMutationProjectionRowWithBinding = async (
  target: ContentProjectionSyncTarget,
  row: MainserverProjectionRowInput
): Promise<MainserverProjectionRowInput> => {
  const principalContext = requireMutationProjectionPrincipalContext(target);
  const rowWithoutSyntheticOwner = {
    ...row,
    ownerUserId: undefined,
    ownerOrganizationId: undefined,
    credentialSource: principalContext.actingPrincipalType,
    credentialFingerprint: principalContext.credentialFingerprint,
    authorizationMode: principalContext.authorizationMode,
  } satisfies MainserverProjectionRowInput;

  if (principalContext.authorizationMode !== 'exact' || !row.sourceDataProviderId) {
    return rowWithoutSyntheticOwner;
  }

  const principalId =
    principalContext.actingPrincipalType === 'organization'
      ? target.organizationId
      : target.actorAccountId;
  if (!principalId) {
    return rowWithoutSyntheticOwner;
  }

  try {
    const binding = await loadCurrentMainserverDataProviderBinding({
      instanceId: target.instanceId,
      principalType: principalContext.actingPrincipalType,
      principalId,
      credentialFingerprint: principalContext.credentialFingerprint,
    });
    if (binding?.dataProviderId !== row.sourceDataProviderId) {
      return rowWithoutSyntheticOwner;
    }

    return {
      ...rowWithoutSyntheticOwner,
      ...(principalContext.actingPrincipalType === 'organization'
        ? { ownerOrganizationId: principalId }
        : { ownerUserId: principalId }),
    };
  } catch (error) {
    contentProjectionLogger.warn('mainserver_projection_mutation_binding_failed', {
      ...buildProjectionLogContext(target, 'mutation_follow_up'),
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
    return rowWithoutSyntheticOwner;
  }
};
