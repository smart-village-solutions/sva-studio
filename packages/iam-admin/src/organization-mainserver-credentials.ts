import type { IamOrganizationMainserverProvisioningStatus } from '@sva/core';
import {
  writeOrganizationMainserverCredentials,
  type OrganizationMainserverCredentialWriteInput,
} from './organization-mainserver-credential-write.js';
import type { QueryClient } from './query-client.js';

export type OrganizationMainserverCredentialRow = {
  readonly mainserver_application_id: string | null;
  readonly mainserver_application_secret_ciphertext: string | null;
  readonly technical_account_id: string | null;
  readonly provisioning_status: IamOrganizationMainserverProvisioningStatus;
  readonly operation_reference: string | null;
  readonly provisioning_phase: string | null;
  readonly attempt_count: number;
  readonly lease_expires_at: string | null;
  readonly last_error_code: string | null;
  readonly last_attempt_at: string | null;
  readonly completed_at: string | null;
  readonly last_verified_at: string | null;
};

export type OrganizationMainserverCredentialState = {
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecretSet: boolean;
  readonly technicalAccountId?: string;
  readonly provisioningStatus: IamOrganizationMainserverProvisioningStatus;
  readonly operationReference?: string;
  readonly provisioningPhase?: string;
  readonly attemptCount: number;
  readonly leaseExpiresAt?: string;
  readonly lastErrorCode?: string;
  readonly lastAttemptAt?: string;
  readonly completedAt?: string;
  readonly lastVerifiedAt?: string;
};

export const buildOrganizationMainserverSecretAad = (organizationId: string): string =>
  `iam.organization_mainserver_credentials.mainserver_application_secret:${organizationId}`;

export const projectOrganizationMainserverCredentialState = (
  row: OrganizationMainserverCredentialRow
): OrganizationMainserverCredentialState => ({
  mainserverApplicationId: row.mainserver_application_id ?? undefined,
  mainserverApplicationSecretSet: Boolean(row.mainserver_application_secret_ciphertext),
  technicalAccountId: row.technical_account_id ?? undefined,
  provisioningStatus: row.provisioning_status,
  operationReference: row.operation_reference ?? undefined,
  provisioningPhase: row.provisioning_phase ?? undefined,
  attemptCount: row.attempt_count,
  leaseExpiresAt: row.lease_expires_at ?? undefined,
  lastErrorCode: row.last_error_code ?? undefined,
  lastAttemptAt: row.last_attempt_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
  lastVerifiedAt: row.last_verified_at ?? undefined,
});

const emptyOrganizationMainserverCredentialState = (): OrganizationMainserverCredentialState => ({
  mainserverApplicationSecretSet: false,
  provisioningStatus: 'not_provisioned',
  attemptCount: 0,
});

const loadOrganizationMainserverCredentialRow = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
  }
): Promise<OrganizationMainserverCredentialRow | null> => {
  const result = await client.query<OrganizationMainserverCredentialRow>(
    `
SELECT
  mainserver_application_id,
  mainserver_application_secret_ciphertext,
  technical_account_id,
  provisioning_status,
  operation_reference,
  provisioning_phase,
  attempt_count,
  lease_expires_at::text,
  last_error_code,
  last_attempt_at::text,
  completed_at::text,
  last_verified_at::text
FROM iam.organization_mainserver_credentials
WHERE instance_id = $1
  AND organization_id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.organizationId]
  );

  return result.rows[0] ?? null;
};

export const loadOrganizationMainserverCredentialState = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
  }
): Promise<OrganizationMainserverCredentialState> => {
  const row = await loadOrganizationMainserverCredentialRow(client, input);
  if (!row) {
    return emptyOrganizationMainserverCredentialState();
  }

  return projectOrganizationMainserverCredentialState(row);
};

export const upsertOrganizationMainserverCredentials = async (
  client: QueryClient,
  input: OrganizationMainserverCredentialWriteInput
): Promise<OrganizationMainserverCredentialState> => {
  const currentRow = await loadOrganizationMainserverCredentialRow(client, input);
  return writeOrganizationMainserverCredentials(client, input, currentRow);
};

export type OrganizationMainserverProvisioningReservation = {
  readonly acquired: boolean;
  readonly state: OrganizationMainserverCredentialState;
};

export const reserveOrganizationMainserverProvisioning = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
    readonly operationReference: string;
    readonly actorAccountId: string;
    readonly leaseSeconds: number;
    readonly allowReadyRefresh?: boolean;
  }
): Promise<OrganizationMainserverProvisioningReservation> => {
  const result = await client.query<OrganizationMainserverCredentialRow>(
    `
INSERT INTO iam.organization_mainserver_credentials (
  instance_id,
  organization_id,
  provisioning_status,
  operation_reference,
  provisioning_phase,
  attempt_count,
  lease_expires_at,
  last_attempt_at,
  updated_by_account_id
)
VALUES ($1, $2::uuid, 'provisioning', $3, 'reserved', 1, NOW() + ($4 * INTERVAL '1 second'), NOW(), $5::uuid)
ON CONFLICT (instance_id, organization_id) DO UPDATE
SET
  provisioning_status = 'provisioning',
  operation_reference = EXCLUDED.operation_reference,
  provisioning_phase = CASE
    WHEN iam.organization_mainserver_credentials.operation_reference = EXCLUDED.operation_reference
      THEN iam.organization_mainserver_credentials.provisioning_phase
    ELSE 'reserved'
  END,
  attempt_count = CASE
    WHEN iam.organization_mainserver_credentials.operation_reference = EXCLUDED.operation_reference
      THEN iam.organization_mainserver_credentials.attempt_count
    ELSE iam.organization_mainserver_credentials.attempt_count + 1
  END,
  lease_expires_at = EXCLUDED.lease_expires_at,
  last_attempt_at = CASE
    WHEN iam.organization_mainserver_credentials.operation_reference = EXCLUDED.operation_reference
      THEN iam.organization_mainserver_credentials.last_attempt_at
    ELSE NOW()
  END,
  last_error_code = NULL,
  updated_by_account_id = EXCLUDED.updated_by_account_id,
  updated_at = NOW()
WHERE iam.organization_mainserver_credentials.provisioning_status NOT IN ('provisioning', 'ready')
   OR (
     $6::boolean
     AND iam.organization_mainserver_credentials.provisioning_status = 'ready'
     AND iam.organization_mainserver_credentials.operation_reference IS DISTINCT FROM EXCLUDED.operation_reference
   )
   OR (
     iam.organization_mainserver_credentials.provisioning_status = 'provisioning'
     AND iam.organization_mainserver_credentials.lease_expires_at <= NOW()
   )
RETURNING
  mainserver_application_id,
  mainserver_application_secret_ciphertext,
  technical_account_id,
  provisioning_status,
  operation_reference,
  provisioning_phase,
  attempt_count,
  lease_expires_at::text,
  last_error_code,
  last_attempt_at::text,
  completed_at::text,
  last_verified_at::text;
`,
    [
      input.instanceId,
      input.organizationId,
      input.operationReference,
      input.leaseSeconds,
      input.actorAccountId,
      input.allowReadyRefresh === true,
    ]
  );
  const reserved = result.rows[0];
  if (reserved) {
    return { acquired: true, state: projectOrganizationMainserverCredentialState(reserved) };
  }

  return {
    acquired: false,
    state: await loadOrganizationMainserverCredentialState(client, input),
  };
};

export const updateOrganizationMainserverProvisioningState = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
    readonly operationReference: string;
    readonly provisioningStatus: IamOrganizationMainserverProvisioningStatus;
    readonly provisioningPhase: string;
    readonly technicalAccountId?: string;
    readonly lastErrorCode?: string;
    readonly complete?: boolean;
    readonly verified?: boolean;
    readonly releaseLease?: boolean;
  }
): Promise<OrganizationMainserverCredentialState | null> => {
  const result = await client.query<OrganizationMainserverCredentialRow>(
    `
UPDATE iam.organization_mainserver_credentials
SET
  provisioning_status = $4,
  provisioning_phase = $5,
  technical_account_id = COALESCE($6::uuid, technical_account_id),
  last_error_code = $7,
  lease_expires_at = CASE WHEN $8::boolean THEN NULL ELSE lease_expires_at END,
  completed_at = CASE WHEN $9::boolean THEN NOW() ELSE completed_at END,
  last_verified_at = CASE WHEN $10::boolean THEN NOW() ELSE last_verified_at END,
  updated_at = NOW()
WHERE instance_id = $1
  AND organization_id = $2::uuid
  AND operation_reference = $3
  AND provisioning_status = 'provisioning'
  AND lease_expires_at > NOW()
RETURNING
  mainserver_application_id,
  mainserver_application_secret_ciphertext,
  technical_account_id,
  provisioning_status,
  operation_reference,
  provisioning_phase,
  attempt_count,
  lease_expires_at::text,
  last_error_code,
  last_attempt_at::text,
  completed_at::text,
  last_verified_at::text;
`,
    [
      input.instanceId,
      input.organizationId,
      input.operationReference,
      input.provisioningStatus,
      input.provisioningPhase,
      input.technicalAccountId ?? null,
      input.lastErrorCode ?? null,
      input.releaseLease ?? false,
      input.complete ?? false,
      input.verified ?? false,
    ]
  );
  const row = result.rows[0];
  return row ? projectOrganizationMainserverCredentialState(row) : null;
};
