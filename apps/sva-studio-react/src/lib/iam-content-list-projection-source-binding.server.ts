import {
  loadCurrentMainserverDataProviderBinding,
  readEffectiveSvaMainserverCredentialsWithStatus,
  readMainserverScopeResolverMode,
} from '@sva/auth-runtime/server';
import type { IamContentListItem } from '@sva/core';
import type { SvaMainserverProjectionListItem } from '@sva/sva-mainserver';
import { createSdkLogger } from '@sva/server-runtime';
import { listSvaMainserverProjection } from '@sva/sva-mainserver/server';

import { createListErrorResponse } from './iam-content-list-api.shared.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
} from './iam-content-list-projection-model.server.js';
import {
  GENERIC_ITEMS_CONTENT_TYPE,
  hasNextProjectionPage,
  mainserverProjectionPageLoaders,
  registeredGenericItemContentTypes,
  toProjectionPrincipalContext,
  type MainserverProjectionLoadedPage,
} from './iam-content-list-projection-source-loaders.server.js';
import { studioMainserverGenericTypeOwnership } from './mainserver-generic-type-registry.server.js';

const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'info',
});

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
