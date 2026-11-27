import type { SuccessfulExternalContentMutation } from './external-content-mutations.js';

export const buildMainserverContentMutation = ({
  actingPrincipalType,
  row,
  ownershipPrincipal,
  preserveExistingContentState,
  ...mutation
}: Pick<
  SuccessfulExternalContentMutation,
  | 'instanceId'
  | 'actorAccountId'
  | 'actorDisplayName'
  | 'mutationRef'
  | 'operation'
  | 'sourceEntityType'
  | 'sourceEntityId'
  | 'contentType'
> & {
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly ownershipPrincipal?: SuccessfulExternalContentMutation['ownershipPrincipal'];
  readonly preserveExistingContentState?: boolean;
  readonly row: Pick<
    SuccessfulExternalContentMutation,
    'organizationId' | 'title' | 'payload' | 'status' | 'publishedAt' | 'authorDisplayMode'
  > & { readonly author: string };
}): SuccessfulExternalContentMutation => {
  const ownerOnly = Boolean(ownershipPrincipal && preserveExistingContentState);
  const isPersonalAuthor = actingPrincipalType === 'user' || (!ownerOnly && !row.organizationId);
  return {
    ...mutation,
    sourceSystem: 'mainserver',
    ...(ownershipPrincipal ? { ownershipPrincipal } : {}),
    ...(preserveExistingContentState ? { preserveExistingContentState: true } : {}),
    ...(row.organizationId ? { organizationId: row.organizationId } : {}),
    title: row.title,
    payload: row.payload,
    status: row.status,
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    authorDisplayMode: isPersonalAuthor ? 'user' : row.authorDisplayMode,
    authorDisplayName:
      isPersonalAuthor && !ownershipPrincipal ? mutation.actorDisplayName : row.author,
  };
};
