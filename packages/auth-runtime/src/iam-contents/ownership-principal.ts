import type { IamContentOwnerPrincipal } from '@sva/core';

export const resolveContentOwnerPrincipal = (content: {
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
}): IamContentOwnerPrincipal | undefined => {
  if (content.ownerOrganizationId) {
    return { type: 'organization', id: content.ownerOrganizationId };
  }
  if (content.ownerUserId) {
    return { type: 'account', id: content.ownerUserId };
  }
  return undefined;
};
