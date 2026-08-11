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

const projectWrittenState = (
  currentRow: OrganizationMainserverCredentialRow | null,
  applicationId: string | null,
  secretCiphertext: string | null
): OrganizationMainserverCredentialState => ({
  mainserverApplicationId: applicationId ?? undefined,
  mainserverApplicationSecretSet: Boolean(secretCiphertext),
  technicalAccountId: currentRow?.technical_account_id ?? undefined,
  provisioningStatus:
    applicationId && secretCiphertext ? 'verification_required' : 'not_provisioned',
  operationReference: currentRow?.operation_reference ?? undefined,
  provisioningPhase: currentRow?.provisioning_phase ?? undefined,
  attemptCount: currentRow?.attempt_count ?? 0,
  leaseExpiresAt: currentRow?.lease_expires_at ?? undefined,
  lastErrorCode: currentRow?.last_error_code ?? undefined,
  lastAttemptAt: currentRow?.last_attempt_at ?? undefined,
  completedAt: currentRow?.completed_at ?? undefined,
  lastVerifiedAt: currentRow?.last_verified_at ?? undefined,
});

export const writeOrganizationMainserverCredentials = async (
  client: QueryClient,
  input: OrganizationMainserverCredentialWriteInput,
  currentRow: OrganizationMainserverCredentialRow | null
): Promise<OrganizationMainserverCredentialState> => {
  const { applicationId, secretCiphertext } = resolveCredentialValues(input, currentRow);
  if (!applicationId && !secretCiphertext) {
    return projectWrittenState(currentRow, null, null);
  }
  await client.query(
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
  updated_by_account_id = COALESCE(EXCLUDED.updated_by_account_id, iam.organization_mainserver_credentials.updated_by_account_id),
  updated_at = NOW();
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
  return projectWrittenState(currentRow, applicationId, secretCiphertext);
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
