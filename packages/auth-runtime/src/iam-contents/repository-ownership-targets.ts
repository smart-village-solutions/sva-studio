import type { IamContentOwnerPrincipal, IamContentOwnershipTargetList } from '@sva/core';
import {
  loadOrganizationList,
  loadMappedUsersBySubject,
  resolveUsersWithPagination,
} from '@sva/iam-admin';
import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { loadContentOwnershipAccountTargets } from './ownership-account-targets.js';

export const loadContentOwnershipTargets = async (
  instanceId: string,
  input: {
    readonly type: 'account' | 'organization';
    readonly page: number;
    readonly pageSize: number;
    readonly search?: string;
    readonly currentOwner?: IamContentOwnerPrincipal;
  }
): Promise<IamContentOwnershipTargetList> => {
  if (input.type === 'account') {
    const accountInput = {
      instanceId,
      page: input.page,
      pageSize: input.pageSize,
      ...(input.currentOwner?.type === 'account'
        ? { excludeAccountId: input.currentOwner.id }
        : {}),
    };
    const result = input.search
      ? await loadContentOwnershipAccountTargets({
          ...accountInput,
          search: input.search,
          loadMappedAccounts: (subjects) =>
            withInstanceScopedDb(instanceId, (client) =>
              loadMappedUsersBySubject(client, {
                instanceId,
                subjects,
                activeLifecycleOnly: true,
                includeTechnicalAccounts: false,
              })
            ),
        })
      : await withInstanceScopedDb(instanceId, (client) =>
          resolveUsersWithPagination(client, {
            ...accountInput,
            status: 'active',
            activeLifecycleOnly: true,
            includeTechnicalAccounts: false,
          })
        );
    const items = result.users.map((user) => ({
      principal: { type: 'account' as const, id: user.id },
      displayName: user.displayName,
    }));
    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
    };
  }

  const result = await withInstanceScopedDb(instanceId, (client) =>
    loadOrganizationList(client, {
      instanceId,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search,
      isActive: true,
      ...(input.currentOwner?.type === 'organization'
        ? { excludeOrganizationId: input.currentOwner.id }
        : {}),
      sortBy: 'displayName',
      sortDirection: 'asc',
    })
  );
  const items = result.items.map((organization) => ({
    principal: { type: 'organization' as const, id: organization.id },
    displayName: organization.displayName,
  }));
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
};
