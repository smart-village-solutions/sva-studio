import type { IamUserListItem } from '@sva/core';

import { trackKeycloakCall } from '../iam-account-management/shared-observability.js';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';

const KEYCLOAK_SEARCH_WINDOW_SIZE = 100;
const MAX_KEYCLOAK_SEARCH_WINDOWS = 10;

export class ContentOwnershipAccountSearchError extends Error {
  readonly code = 'keycloak_unavailable' as const;

  constructor(cause?: unknown) {
    super('keycloak_unavailable', { cause });
    this.name = 'ContentOwnershipAccountSearchError';
  }
}

const keycloakCall = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (cause) {
    throw new ContentOwnershipAccountSearchError(cause);
  }
};

const isEligibleAccount = (
  account: IamUserListItem,
  excludeAccountId: string | undefined
): boolean =>
  account.id !== excludeAccountId &&
  account.status === 'active' &&
  !account.isTechnicalAccount &&
  account.mappingStatus === 'mapped';

export const loadContentOwnershipAccountTargets = async (input: {
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly excludeAccountId?: string;
  readonly loadMappedAccounts: (
    subjects: readonly string[]
  ) => Promise<ReadonlyMap<string, IamUserListItem>>;
}): Promise<{ readonly users: readonly IamUserListItem[]; readonly total: number }> => {
  const identityProvider = await keycloakCall(() =>
    resolveIdentityProviderForInstance(input.instanceId, {
      executionMode: 'tenant_admin',
    })
  );
  if (!identityProvider) {
    throw new ContentOwnershipAccountSearchError();
  }

  const query = { search: input.search, enabled: true } as const;
  const keycloakTotal = await keycloakCall(async () =>
    identityProvider.provider.countUsers?.(query)
  );
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
    const keycloakUsers = await keycloakCall(() =>
      trackKeycloakCall('list_content_ownership_account_targets', () =>
        identityProvider.provider.listUsers({
          ...query,
          first,
          max: KEYCLOAK_SEARCH_WINDOW_SIZE,
        })
      )
    );
    const mappedAccounts = await input.loadMappedAccounts(
      keycloakUsers.map((user) => user.externalId)
    );
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

  return {
    users: eligibleAccounts.slice(requestedFirst, requestedEnd),
    total: exhausted
      ? eligibleAccounts.length
      : Math.max(eligibleAccounts.length, requestedEnd + 1),
  };
};
