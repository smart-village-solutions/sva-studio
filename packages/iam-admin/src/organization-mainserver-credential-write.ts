import { protectField } from './encryption.js';
import type {
  OrganizationMainserverCredentialRow,
  OrganizationMainserverCredentialState,
} from './organization-mainserver-credentials.js';
import type { QueryClient } from './query-client.js';

export type OrganizationMainserverCredentialWriteInput = {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly actorAccountId?: string;
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecret?: string;
};

export type ActiveOrganizationProvisioningCredentialWriteInput = {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly operationReference: string;
  readonly actorAccountId: string;
  readonly mainserverApplicationId: string;
  readonly mainserverApplicationSecret: string;
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveCredentialValues = (
  input: OrganizationMainserverCredentialWriteInput,
  currentRow: OrganizationMainserverCredentialRow | null
) => {
  const applicationId =
    input.mainserverApplicationId !== undefined
      ? normalizeOptionalText(input.mainserverApplicationId)
      : (currentRow?.mainserver_application_id ?? null);
  const secret = normalizeOptionalText(input.mainserverApplicationSecret);
  const secretCiphertext = secret
    ? protectField(
        secret,
        `iam.organization_mainserver_credentials.mainserver_application_secret:${input.organizationId}`
      )
    : (currentRow?.mainserver_application_secret_ciphertext ?? null);
  return { applicationId, secretCiphertext };
};

const resolveProjectedProvisioningStatus = (
  currentRow: OrganizationMainserverCredentialRow | null,
  applicationId: string | null,
  secretCiphertext: string | null,
  credentialsChanged: boolean
): OrganizationMainserverCredentialState['provisioningStatus'] => {
  if (!credentialsChanged && currentRow) {
    return currentRow.provisioning_status;
  }
  return applicationId && secretCiphertext ? 'verification_required' : 'not_provisioned';
};

const preserveUnlessCredentialsChanged = <T>(
  credentialsChanged: boolean,
  value: T | null | undefined
): T | undefined => (credentialsChanged ? undefined : (value ?? undefined));

const projectWrittenState = (
  currentRow: OrganizationMainserverCredentialRow | null,
  applicationId: string | null,
  secretCiphertext: string | null,
  credentialsChanged: boolean
): OrganizationMainserverCredentialState => ({
  mainserverApplicationId: applicationId ?? undefined,
  mainserverApplicationSecretSet: Boolean(secretCiphertext),
  technicalAccountId: currentRow?.technical_account_id ?? undefined,
  provisioningStatus: resolveProjectedProvisioningStatus(
    currentRow,
    applicationId,
    secretCiphertext,
    credentialsChanged
  ),
  operationReference: preserveUnlessCredentialsChanged(
    credentialsChanged,
    currentRow?.operation_reference
  ),
  provisioningPhase: preserveUnlessCredentialsChanged(
    credentialsChanged,
    currentRow?.provisioning_phase
  ),
  attemptCount: currentRow?.attempt_count ?? 0,
  leaseExpiresAt: preserveUnlessCredentialsChanged(
    credentialsChanged,
    currentRow?.lease_expires_at
  ),
  lastErrorCode: preserveUnlessCredentialsChanged(
    credentialsChanged,
    currentRow?.last_error_code
  ),
  lastAttemptAt: currentRow?.last_attempt_at ?? undefined,
  completedAt: preserveUnlessCredentialsChanged(credentialsChanged, currentRow?.completed_at),
  lastVerifiedAt: preserveUnlessCredentialsChanged(
    credentialsChanged,
    currentRow?.last_verified_at
  ),
});

export const writeOrganizationMainserverCredentials = async (
  client: QueryClient,
  input: OrganizationMainserverCredentialWriteInput,
  currentRow: OrganizationMainserverCredentialRow | null
): Promise<OrganizationMainserverCredentialState> => {
  const { applicationId, secretCiphertext } = resolveCredentialValues(input, currentRow);
  const hasNewSecret = normalizeOptionalText(input.mainserverApplicationSecret) !== null;
  const credentialsChanged =
    applicationId !== (currentRow?.mainserver_application_id ?? null) || hasNewSecret;
  if (currentRow && !credentialsChanged) {
    return projectWrittenState(currentRow, applicationId, secretCiphertext, false);
  }
  if (!applicationId && !secretCiphertext) {
    return projectWrittenState(currentRow, null, null, credentialsChanged);
  }
  const result = await client.query(
    `
INSERT INTO iam.organization_mainserver_credentials (
  instance_id,
  organization_id,
  mainserver_application_id,
  mainserver_application_secret_ciphertext,
  updated_by_account_id,
  provisioning_status
)
VALUES ($1, $2::uuid, $3, $4, $5::uuid, $6)
  ON CONFLICT (instance_id, organization_id) DO UPDATE
SET
  mainserver_application_id = EXCLUDED.mainserver_application_id,
  mainserver_application_secret_ciphertext = EXCLUDED.mainserver_application_secret_ciphertext,
  provisioning_status = CASE
    WHEN EXCLUDED.mainserver_application_id IS NOT NULL
      AND EXCLUDED.mainserver_application_secret_ciphertext IS NOT NULL
      THEN 'verification_required'
    ELSE 'not_provisioned'
  END,
  operation_reference = NULL,
  provisioning_phase = NULL,
  lease_expires_at = NULL,
  last_error_code = NULL,
  completed_at = NULL,
  last_verified_at = NULL,
  updated_by_account_id = COALESCE(EXCLUDED.updated_by_account_id, iam.organization_mainserver_credentials.updated_by_account_id),
  updated_at = NOW()
WHERE NOT (
  iam.organization_mainserver_credentials.provisioning_status = 'provisioning'
  AND iam.organization_mainserver_credentials.lease_expires_at > NOW()
);
`,
    [
      input.instanceId,
      input.organizationId,
      applicationId,
      secretCiphertext,
      input.actorAccountId ?? null,
      applicationId && secretCiphertext ? 'verification_required' : 'not_provisioned',
    ]
  );
  if (result.rowCount === 0) {
    throw new Error('organization_mainserver_provisioning_in_progress');
  }
  return projectWrittenState(currentRow, applicationId, secretCiphertext, credentialsChanged);
};

export const writeActiveOrganizationProvisioningCredentials = async (
  client: QueryClient,
  input: ActiveOrganizationProvisioningCredentialWriteInput
): Promise<boolean> => {
  const applicationId = normalizeOptionalText(input.mainserverApplicationId);
  const secret = normalizeOptionalText(input.mainserverApplicationSecret);
  if (!applicationId || !secret) {
    throw new Error('organization_mainserver_credentials_invalid');
  }
  const secretCiphertext = protectField(
    secret,
    `iam.organization_mainserver_credentials.mainserver_application_secret:${input.organizationId}`
  );
  const result = await client.query<{ persisted: boolean }>(
    `
UPDATE iam.organization_mainserver_credentials
SET
  mainserver_application_id = $4,
  mainserver_application_secret_ciphertext = $5,
  provisioning_phase = 'credentials_persisted',
  last_error_code = NULL,
  updated_by_account_id = $6::uuid,
  updated_at = NOW()
WHERE instance_id = $1
  AND organization_id = $2::uuid
  AND operation_reference = $3
  AND provisioning_status = 'provisioning'
  AND lease_expires_at > NOW()
RETURNING TRUE AS persisted;
`,
    [
      input.instanceId,
      input.organizationId,
      input.operationReference,
      applicationId,
      secretCiphertext,
      input.actorAccountId,
    ]
  );
  return result.rows[0]?.persisted === true;
};
