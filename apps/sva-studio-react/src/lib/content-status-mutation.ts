import type { IamContentListItem, IamContentStatus } from '@sva/core';
import type { ContentTypeMutations } from '@sva/plugin-sdk';
import type {
  MainserverPrincipalControlModel,
  MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { studioContentTypes } from './plugins';

export const resolveStandaloneMainserverPrincipal = (
  item: Pick<IamContentListItem, 'credentialSource'>,
  principalControl: MainserverPrincipalControlModel | undefined
): MainserverPrincipalType | undefined => {
  if (item.credentialSource === 'organization' || item.credentialSource === 'user') {
    return item.credentialSource;
  }

  // Only a personal context without an active organization is a safe legacy
  // fallback. Organization policies never identify the owner of an existing resource.
  return principalControl?.kind === 'fixed' && principalControl.value === 'user'
    ? 'user'
    : undefined;
};

export const getContentMutations = (contentType: string): ContentTypeMutations | undefined =>
  studioContentTypes.find((definition) => definition.contentType === contentType)?.mutations;

export const isContentMutationAvailable = (
  contentType: string,
  operation: 'delete' | 'status',
  permissionActions: readonly string[],
  enabledMainserverMutationActions: readonly string[]
): boolean => {
  const capability = getContentMutations(contentType)?.[operation];
  return (
    capability !== undefined &&
    permissionActions.includes(capability.requiredAction) &&
    (!capability.requiresMainserverMutationAction ||
      enabledMainserverMutationActions.includes(capability.requiredAction))
  );
};

export const getSupportedQuickStatuses = (contentType: string): readonly IamContentStatus[] =>
  getContentMutations(contentType)?.status?.supportedStatuses ?? [];

export const updateMainserverContentStatus = async (
  item: Pick<IamContentListItem, 'contentType' | 'id' | 'access'>,
  status: IamContentStatus,
  actingPrincipalType: MainserverPrincipalType,
  permissionActions: readonly string[],
  enabledMainserverMutationActions: readonly string[]
): Promise<void> => {
  const capability = getContentMutations(item.contentType)?.status;
  if (!capability || !capability.supportedStatuses.includes(status)) {
    throw new Error(`unsupported_content_status:${item.contentType}:${status}`);
  }
  if (
    (actingPrincipalType !== 'user' && actingPrincipalType !== 'organization') ||
    item.access?.state === 'server_denied' ||
    !item.access?.canUpdate ||
    !isContentMutationAvailable(
      item.contentType,
      'status',
      permissionActions,
      enabledMainserverMutationActions
    )
  ) {
    throw new Error('content_mutation_unavailable');
  }
  await capability.execute(item.id, status, actingPrincipalType);
};
