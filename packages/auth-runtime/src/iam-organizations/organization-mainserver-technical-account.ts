import type { IamUserListItem } from '@sva/core';
import {
  loadMappedUsersBySubject,
  updateOrganizationMainserverProvisioningState,
} from '@sva/iam-admin';

import { persistCreatedUser } from '../iam-account-management/user-create-persistence.js';
import {
  emitActivityLog,
  trackKeycloakCall,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import type { IdentityProviderResolution } from '../iam-account-management/shared-runtime.js';
import { organizationProvisioningLogger } from './organization-mainserver-provisioning.shared.js';

const ACCOUNT_PURPOSE = 'organization_mainserver';
const EMAIL_DOMAIN = 'smart-village.app';
const ASCII_ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

export type DerivedOrganizationTechnicalIdentity = {
  readonly email: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
};

const normalizeAsciiSegment = (value: string, fallback: string): string => {
  const asciiCandidate = value
    .normalize('NFKD')
    .replaceAll('ß', 'ss')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let normalized = '';
  for (const character of asciiCandidate) {
    if (ASCII_ALPHANUMERIC.includes(character)) {
      normalized += character;
    } else if (normalized.length > 0 && !normalized.endsWith('.')) {
      normalized += '.';
    }
    if (normalized.length === 24) {
      break;
    }
  }
  if (normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || fallback;
};

const stableOrganizationSuffix = (organizationId: string): string =>
  organizationId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-8)
    .padStart(8, '0');

export const deriveOrganizationTechnicalIdentity = (input: {
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly tenantDisplayName: string;
  readonly collisionSafe?: boolean;
}): DerivedOrganizationTechnicalIdentity => {
  const organization = normalizeAsciiSegment(input.organizationDisplayName, 'organization');
  const tenant = normalizeAsciiSegment(input.tenantDisplayName, 'tenant');
  const suffix = input.collisionSafe ? `.${stableOrganizationSuffix(input.organizationId)}` : '';
  const email = `${organization}.${tenant}${suffix}@${EMAIL_DOMAIN}`;
  return {
    email,
    username: email,
    firstName: input.organizationDisplayName,
    lastName: input.tenantDisplayName,
  };
};

const hasTechnicalIdentityAttributes = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  input: { readonly instanceId: string; readonly organizationId: string }
): boolean =>
  attributes?.instanceId?.includes(input.instanceId) === true &&
  attributes.organizationId?.includes(input.organizationId) === true &&
  attributes.accountPurpose?.includes(ACCOUNT_PURPOSE) === true;

const findRecoverableIdentity = async (
  identityProvider: IdentityProviderResolution,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
    readonly identity: DerivedOrganizationTechnicalIdentity;
  }
) => {
  const matches = await trackKeycloakCall('list_users', () =>
    identityProvider.provider.listUsers({ email: input.identity.email, max: 20 })
  );
  const exact = matches.filter(
    (user) =>
      user.email?.toLowerCase() === input.identity.email &&
      user.username?.toLowerCase() === input.identity.username &&
      hasTechnicalIdentityAttributes(user.attributes, input)
  );
  if (exact.length > 1) {
    throw new Error('organization_technical_account_ambiguous');
  }
  return { recovered: exact[0], occupied: matches.length > 0 };
};

const loadMappedAccountById = async (
  instanceId: string,
  accountId: string
): Promise<IamUserListItem | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<{ readonly keycloak_subject: string }>(
      `
SELECT keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
      [instanceId, accountId]
    );
    const subject = result.rows[0]?.keycloak_subject;
    if (!subject) {
      return undefined;
    }
    return (await loadMappedUsersBySubject(client, { instanceId, subjects: [subject] })).get(
      subject
    );
  });

const classifyRecoveredAccount = async (
  client: Parameters<typeof emitActivityLog>[0],
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
    readonly actorAccountId: string;
    readonly account: IamUserListItem;
  }
): Promise<IamUserListItem> => {
  if (input.account.isTechnicalAccount) {
    return input.account;
  }
  await client.query(
    `
UPDATE iam.accounts
SET is_technical_account = TRUE,
    updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
  AND is_technical_account = FALSE;
`,
    [input.instanceId, input.account.id]
  );
  await emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    subjectId: input.account.id,
    eventType: 'user.technical_classification_changed',
    result: 'success',
    payload: {
      old_value: false,
      new_value: true,
      reason: 'organization_mainserver_account_recovery',
      organization_id: input.organizationId,
    },
  });
  return { ...input.account, isTechnicalAccount: true };
};

const attachTechnicalAccount = async (input: {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly operationReference: string;
  readonly actorAccountId: string;
  readonly actorSubject: string;
  readonly identityProvider: IdentityProviderResolution;
  readonly identity: DerivedOrganizationTechnicalIdentity;
  readonly externalId: string;
  readonly createdExternally: boolean;
}): Promise<IamUserListItem> => {
  try {
    return await withInstanceScopedDb(input.instanceId, async (client) => {
      const mapped = await loadMappedUsersBySubject(client, {
        instanceId: input.instanceId,
        subjects: [input.externalId],
      });
      const existing = mapped.get(input.externalId);
      const account = existing
        ? await classifyRecoveredAccount(client, { ...input, account: existing })
        : (
            await persistCreatedUser(client, {
              actor: { instanceId: input.instanceId, actorAccountId: input.actorAccountId },
              actorSubject: input.actorSubject,
              externalId: input.externalId,
              payload: {
                email: input.identity.email,
                firstName: input.identity.firstName,
                lastName: input.identity.lastName,
                displayName: input.identity.firstName,
                status: 'active',
                isTechnicalAccount: true,
                roleIds: [],
                groupIds: [],
              },
            })
          ).responseData;

      const state = await updateOrganizationMainserverProvisioningState(client, {
        instanceId: input.instanceId,
        organizationId: input.organizationId,
        operationReference: input.operationReference,
        provisioningStatus: 'provisioning',
        provisioningPhase: 'account_persisted',
        technicalAccountId: account.id,
      });
      if (!state) {
        throw new Error('organization_provisioning_lease_lost');
      }
      return account;
    });
  } catch (error) {
    if (input.createdExternally) {
      await trackKeycloakCall('deactivate_user_compensation', () =>
        input.identityProvider.provider.deactivateUser(input.externalId)
      ).catch((compensationError: unknown) => {
        organizationProvisioningLogger.error('Organization technical account compensation failed', {
          workspace_id: input.instanceId,
          context: {
            operation: 'organization_mainserver_provisioning_compensation',
            organization_id: input.organizationId,
            keycloak_subject: input.externalId,
            error_type:
              compensationError instanceof Error
                ? compensationError.constructor.name
                : typeof compensationError,
          },
        });
      });
    }
    throw error;
  }
};

export const resolveOrganizationTechnicalAccount = async (input: {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly organizationDisplayName: string;
  readonly tenantDisplayName: string;
  readonly technicalAccountId?: string;
  readonly operationReference: string;
  readonly actorAccountId: string;
  readonly actorSubject: string;
  readonly identityProvider: IdentityProviderResolution;
}): Promise<{
  readonly account: IamUserListItem;
  readonly identity: DerivedOrganizationTechnicalIdentity;
}> => {
  if (input.technicalAccountId) {
    const account = await loadMappedAccountById(input.instanceId, input.technicalAccountId);
    if (account) {
      const derived = deriveOrganizationTechnicalIdentity(input);
      return {
        account,
        identity: {
          email: account.email ?? derived.email,
          username: account.email ?? derived.username,
          firstName: input.organizationDisplayName,
          lastName: input.tenantDisplayName,
        },
      };
    }
  }

  let identity = deriveOrganizationTechnicalIdentity(input);
  let candidate = await findRecoverableIdentity(input.identityProvider, { ...input, identity });
  if (!candidate.recovered && candidate.occupied) {
    identity = deriveOrganizationTechnicalIdentity({ ...input, collisionSafe: true });
    candidate = await findRecoverableIdentity(input.identityProvider, { ...input, identity });
    if (!candidate.recovered && candidate.occupied) {
      throw new Error('organization_technical_account_collision');
    }
  }

  let createdExternally = false;
  let externalId = candidate.recovered?.externalId;
  if (!externalId) {
    const created = await trackKeycloakCall('create_user', () =>
      input.identityProvider.provider.createUser({
        username: identity.username,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        enabled: true,
        attributes: {
          instanceId: input.instanceId,
          organizationId: input.organizationId,
          accountPurpose: ACCOUNT_PURPOSE,
        },
      })
    );
    externalId = created.externalId;
    createdExternally = true;
  }

  const account = await attachTechnicalAccount({
    ...input,
    identity,
    externalId,
    createdExternally,
  });
  return { account, identity };
};
