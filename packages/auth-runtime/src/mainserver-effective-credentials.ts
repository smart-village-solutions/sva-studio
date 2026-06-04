import type { IamContentAuthorPolicy } from '@sva/core';

import { revealField } from './iam-account-management/encryption.js';
import { withInstanceScopedDb } from './iam-account-management/shared-runtime.js';
import {
  type SvaMainserverCredentials,
  readSvaMainserverCredentialsWithStatus,
} from './mainserver-credentials.js';

type EffectiveMainserverCredentialsInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

type OrganizationMainserverCredentialRow = {
  readonly content_author_policy: IamContentAuthorPolicy;
  readonly mainserver_application_id: string | null;
  readonly mainserver_application_secret_ciphertext: string | null;
};

export type EffectiveMainserverCredentialSource = 'organization' | 'user';

export type EffectiveSvaMainserverCredentialsResult =
  | {
      readonly status: 'ok';
      readonly source: EffectiveMainserverCredentialSource;
      readonly credentials: SvaMainserverCredentials;
      readonly organizationId?: string;
    }
  | {
      readonly status: 'organization_mainserver_credentials_missing';
      readonly organizationId: string;
    }
  | {
      readonly status: 'missing_credentials';
    }
  | {
      readonly status: 'identity_provider_unavailable';
    }
  | {
      readonly status: 'database_unavailable';
    };

const buildOrganizationMainserverSecretAad = (organizationId: string): string =>
  `iam.organization_mainserver_credentials.mainserver_application_secret:${organizationId}`;

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const loadOrganizationMainserverCredentialRow = async (
  input: Required<Pick<EffectiveMainserverCredentialsInput, 'instanceId' | 'activeOrganizationId'>>
): Promise<OrganizationMainserverCredentialRow | null> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<OrganizationMainserverCredentialRow>(
      `
SELECT
  organizations.content_author_policy,
  credentials.mainserver_application_id,
  credentials.mainserver_application_secret_ciphertext
FROM iam.organizations AS organizations
LEFT JOIN iam.organization_mainserver_credentials AS credentials
  ON credentials.instance_id = organizations.instance_id
 AND credentials.organization_id = organizations.id
WHERE organizations.instance_id = $1
  AND organizations.id = $2::uuid
LIMIT 1;
`,
      [input.instanceId, input.activeOrganizationId]
    );

    return result.rows[0] ?? null;
  });

const resolveOrganizationCredentials = (
  row: OrganizationMainserverCredentialRow,
  organizationId: string
): SvaMainserverCredentials | null => {
  const apiKey = normalizeOptionalText(row.mainserver_application_id);
  const apiSecret = normalizeOptionalText(
    revealField(
      row.mainserver_application_secret_ciphertext,
      buildOrganizationMainserverSecretAad(organizationId)
    )
  );
  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
};

const resolveUserCredentials = async (
  input: Pick<EffectiveMainserverCredentialsInput, 'instanceId' | 'keycloakSubject'>
): Promise<
  Extract<
    EffectiveSvaMainserverCredentialsResult,
    { readonly status: 'ok' | 'missing_credentials' | 'identity_provider_unavailable' }
  >
> => {
  const result = await readSvaMainserverCredentialsWithStatus(input.keycloakSubject, input.instanceId);
  if (result.status === 'ok') {
    return {
      status: 'ok',
      source: 'user',
      credentials: result.credentials,
    };
  }

  return result;
};

export const readEffectiveSvaMainserverCredentialsWithStatus = async (
  input: EffectiveMainserverCredentialsInput
): Promise<EffectiveSvaMainserverCredentialsResult> => {
  if (!input.activeOrganizationId) {
    return resolveUserCredentials(input);
  }

  let organizationCredentialRow: OrganizationMainserverCredentialRow | null;
  try {
    organizationCredentialRow = await loadOrganizationMainserverCredentialRow({
      instanceId: input.instanceId,
      activeOrganizationId: input.activeOrganizationId,
    });
  } catch {
    return {
      status: 'database_unavailable',
    };
  }

  if (!organizationCredentialRow) {
    return {
      status: 'organization_mainserver_credentials_missing',
      organizationId: input.activeOrganizationId,
    };
  }

  const organizationCredentials = resolveOrganizationCredentials(
    organizationCredentialRow,
    input.activeOrganizationId
  );
  if (organizationCredentialRow.content_author_policy === 'org_only') {
    return organizationCredentials
      ? {
          status: 'ok',
          source: 'organization',
          credentials: organizationCredentials,
          organizationId: input.activeOrganizationId,
        }
      : {
          status: 'organization_mainserver_credentials_missing',
          organizationId: input.activeOrganizationId,
        };
  }

  if (organizationCredentials) {
    return {
      status: 'ok',
      source: 'organization',
      credentials: organizationCredentials,
      organizationId: input.activeOrganizationId,
    };
  }

  return resolveUserCredentials(input);
};

export const readEffectiveSvaMainserverCredentials = async (
  input: EffectiveMainserverCredentialsInput
): Promise<SvaMainserverCredentials | null> => {
  const result = await readEffectiveSvaMainserverCredentialsWithStatus(input);
  return result.status === 'ok' ? result.credentials : null;
};
