import { loadCurrentMainserverDataProviderBinding } from '@sva/auth-runtime/server';
import type { IamContentListItem } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
  getSvaMainserverSurvey,
} from '@sva/sva-mainserver/server';

import {
  mapEventItem,
  mapGenericItem,
  mapNewsItem,
  mapPoiItem,
  mapSurveyItem,
} from './iam-content-list-mainserver.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
  TargetedMutationContentType,
} from './iam-content-list-projection-model.server.js';
import { buildProjectionLogContext } from './iam-content-list-projection-repository.server.js';

const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'info',
});

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
  const transferredAuthorDisplayMode = target.ownershipPrincipal
    ? target.ownershipPrincipal.type === 'account'
      ? 'user'
      : 'organization'
    : undefined;
  const rowWithoutSyntheticOwner = {
    ...row,
    ...(transferredAuthorDisplayMode
      ? { authorDisplayMode: transferredAuthorDisplayMode }
      : {}),
    ownerUserId: undefined,
    ownerOrganizationId: undefined,
    credentialSource: principalContext.actingPrincipalType,
    credentialFingerprint: principalContext.credentialFingerprint,
    authorizationMode: principalContext.authorizationMode,
  } satisfies MainserverProjectionRowInput;

  if (principalContext.authorizationMode !== 'exact' || !row.sourceDataProviderId) {
    return rowWithoutSyntheticOwner;
  }

  const ownershipType = target.ownershipPrincipal?.type ?? principalContext.actingPrincipalType;
  const principalId =
    target.ownershipPrincipal?.id ??
    (principalContext.actingPrincipalType === 'organization'
      ? target.organizationId
      : target.actorAccountId);
  if (!principalId) {
    return rowWithoutSyntheticOwner;
  }

  try {
    const binding = await loadCurrentMainserverDataProviderBinding({
      instanceId: target.instanceId,
      principalType: ownershipType === 'account' ? 'user' : ownershipType,
      principalId,
      credentialFingerprint: principalContext.credentialFingerprint,
    });
    if (binding?.dataProviderId !== row.sourceDataProviderId) {
      return rowWithoutSyntheticOwner;
    }

    return {
      ...rowWithoutSyntheticOwner,
      ...(ownershipType === 'organization'
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
