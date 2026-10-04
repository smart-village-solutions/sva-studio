import type { IamContentOwnerPrincipal } from '@sva/core';
import type { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveContentOwnerPrincipal } from './ownership-principal.js';
import type { ContentRow } from './repository-types.js';

export type ContentOwnershipTransferErrorCode =
  | 'content_not_found'
  | 'ownership_source_changed'
  | 'ownership_target_inactive'
  | 'ownership_target_not_found'
  | 'ownership_target_unchanged';

export class ContentOwnershipTransferError extends Error {
  constructor(readonly code: ContentOwnershipTransferErrorCode) {
    super(code);
    this.name = 'ContentOwnershipTransferError';
  }
}

export const resolveCurrentOwnerPrincipal = (
  row: ContentRow
): IamContentOwnerPrincipal | undefined => {
  return resolveContentOwnerPrincipal({
    ownerUserId: row.owner_user_id ?? undefined,
    ownerOrganizationId: row.owner_organization_id ?? undefined,
  });
};

export const hasExactConfirmedOwner = (
  row: ContentRow,
  target: IamContentOwnerPrincipal
): boolean => target.type === 'organization'
  ? row.owner_organization_id === target.id &&
    row.owner_user_id === null && row.organization_id === target.id
  : row.owner_user_id === target.id &&
    row.owner_organization_id === null && row.organization_id === null;

export const resolveContentItemOwnerPrincipal = (item: {
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
}): IamContentOwnerPrincipal | undefined => {
  return resolveContentOwnerPrincipal(item);
};

export const assertActiveOwnershipTarget = async (
  client: Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0],
  instanceId: string,
  target: IamContentOwnerPrincipal
): Promise<void> => {
  const result =
    target.type === 'account'
      ? await client.query<{ is_active: boolean }>(
          `SELECT (
             status = 'active'
             AND is_blocked = FALSE
             AND soft_deleted_at IS NULL
             AND permanently_deleted_at IS NULL
             AND deletion_lifecycle_state = 'active'
           ) AS is_active
           FROM iam.accounts
           WHERE instance_id = $1
             AND id = $2::uuid
           LIMIT 1;`,
          [instanceId, target.id]
        )
      : await client.query<{ is_active: boolean }>(
          `SELECT is_active
           FROM iam.organizations
           WHERE instance_id = $1
             AND id = $2::uuid
           LIMIT 1;`,
          [instanceId, target.id]
        );

  const row = result.rows[0];
  if (!row) {
    throw new ContentOwnershipTransferError('ownership_target_not_found');
  }
  if (!row.is_active) {
    throw new ContentOwnershipTransferError('ownership_target_inactive');
  }
};
