import type { IamUserListItem } from '@sva/core';
import { loadMappedUsersBySubject } from '@sva/iam-admin';

import type { QueryClient } from '../db.js';
import { trackKeycloakCall } from '../iam-account-management/shared-observability.js';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';

const KEYCLOAK_SEARCH_WINDOW_SIZE = 100;
const MAX_KEYCLOAK_SEARCH_WINDOWS = 10;

const isEligibleAccount = (
  account: IamUserListItem,
  excludeAccountId: string | undefined
): boolean =>
  account.id !== excludeAccountId &&
  account.status === 'active' &&
  !account.isTechnicalAccount &&
  account.mappingStatus === 'mapped';

export const loadContentOwnershipAccountTargets = async (input: {
  readonly client: QueryClient;
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly excludeAccountId?: string;
}): Promise<{ readonly users: readonly IamUserListItem[]; readonly total: number }> => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    throw new Error('tenant_admin_client_not_configured');
  }

  const query = { search: input.search, enabled: true } as const;
  const keycloakTotal = await identityProvider.provider.countUsers?.(query);
  const requestedFirst = Math.max(0, (input.page - 1) * input.pageSize);
  const requestedEnd = requestedFirst + input.pageSize;
  const eligibleAccounts: IamUserListItem[] = [];
  let first = 0;
  let exhausted = keycloakTotal === 0;
  let scannedWindows = 0;

  while (
    !exhausted &&
    eligibleAccounts.length <= requestedEnd &&
    scannedWindows < MAX_KEYCLOAK_SEARCH_WINDOWS
  ) {
    const keycloakUsers = await trackKeycloakCall('list_content_ownership_account_targets', () =>
      identityProvider.provider.listUsers({
        ...query,
        first,
        max: KEYCLOAK_SEARCH_WINDOW_SIZE,
      })
    );
    const mappedAccounts = await loadMappedUsersBySubject(input.client, {
      instanceId: input.instanceId,
      subjects: keycloakUsers.map((user) => user.externalId),
      activeLifecycleOnly: true,
      includeTechnicalAccounts: false,
    });
    for (const keycloakUser of keycloakUsers) {
      const account = mappedAccounts.get(keycloakUser.externalId);
      if (account && isEligibleAccount(account, input.excludeAccountId)) {
        eligibleAccounts.push(account);
      }
    }

    first += keycloakUsers.length;
    scannedWindows += 1;
    exhausted =
      keycloakUsers.length < KEYCLOAK_SEARCH_WINDOW_SIZE ||
      (keycloakTotal !== undefined && first >= keycloakTotal);
    if (keycloakUsers.length === 0) exhausted = true;
  }

  if (!exhausted && eligibleAccounts.length <= requestedEnd) {
    throw new Error('content_ownership_account_search_limit_exceeded');
  }

  return {
    users: eligibleAccounts.slice(requestedFirst, requestedEnd),
    total: exhausted
      ? eligibleAccounts.length
      : Math.max(eligibleAccounts.length, requestedEnd + 1),
  };
};
