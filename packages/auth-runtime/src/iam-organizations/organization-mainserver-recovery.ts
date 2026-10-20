import type { PermissionRevisionVector } from '../iam-authorization/permission-store.keys.js';
import { revisionsEqual } from '../iam-authorization/permission-store.keys.js';
import { readPermissionRevisionVectorWithClient } from '../iam-authorization/permission-revision-store.js';
import {
  createMainserverCredentialFingerprint,
  resolveMainserverCredentialReadiness,
} from '../mainserver-credential-readiness.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { emitActivityLog } from '../iam-account-management/shared-activity.js';
import {
  resolveIdentityProviderForInstance,
  withInstanceScopedDb,
} from '../iam-account-management/shared-runtime.js';
import { lockMainserverDataProviderBindingScope } from '../iam-contents/mainserver-data-provider-binding-lock.js';

type RecoveryInput = Readonly<{
  instanceId: string;
  organizationId: string;
  actorAccountId: string;
  actorSubject: string;
  requestId?: string;
  reauthorize: () => Promise<PermissionRevisionVector | null>;
}>;
type RecoveryRow = {
  application_id: string | null;
  secret_ciphertext: string | null;
  technical_account_id: string;
  keycloak_subject: string;
  last_verified_at: string;
  updated_at: string;
};
export type OrganizationCredentialRecoveryReason =
  | 'restored'
  | 'principal_not_allowed'
  | 'organization_state_not_recoverable'
  | 'technical_account_mismatch'
  | 'keycloak_unavailable'
  | 'keycloak_credentials_incomplete'
  | 'credential_version_mismatch'
  | 'binding_not_verified'
  | 'concurrent_change'
  | 'database_unavailable'
  | 'credential_decryption_failed'
  | 'credential_encryption_unavailable';

// Both snapshots must pass the same eligibility checks. No external call is made under a DB lock.
const recoveryRowSql = `SELECT credentials.mainserver_application_id AS application_id,
 credentials.mainserver_application_secret_ciphertext AS secret_ciphertext,
 credentials.technical_account_id::text, account.keycloak_subject,
 credentials.last_verified_at::text, credentials.updated_at::text
FROM iam.organization_mainserver_credentials credentials
JOIN iam.organizations organization ON organization.instance_id = credentials.instance_id AND organization.id = credentials.organization_id
JOIN iam.accounts account ON account.instance_id = credentials.instance_id AND account.id = credentials.technical_account_id
JOIN iam.account_organizations membership ON membership.instance_id = credentials.instance_id AND membership.organization_id = credentials.organization_id AND membership.account_id = $3::uuid
JOIN iam.accounts actor ON actor.instance_id = membership.instance_id AND actor.id = membership.account_id
WHERE credentials.instance_id = $1 AND credentials.organization_id = $2::uuid
 AND credentials.provisioning_status = 'ready' AND credentials.last_verified_at IS NOT NULL
 AND (credentials.lease_expires_at IS NULL OR credentials.lease_expires_at <= NOW())
 AND (NULLIF(TRIM(credentials.mainserver_application_id), '') IS NULL OR credentials.mainserver_application_secret_ciphertext IS NULL)
 AND organization.is_active = TRUE AND account.status = 'active'
 AND account.deletion_lifecycle_state = 'active' AND account.is_blocked = FALSE
 AND account.soft_deleted_at IS NULL AND account.permanently_deleted_at IS NULL
 AND actor.keycloak_subject = $4 AND actor.status = 'active'
 AND actor.is_blocked = FALSE AND actor.deletion_lifecycle_state = 'active'
 AND NOT EXISTS (SELECT 1 FROM iam.organization_mainserver_credentials other
 WHERE other.instance_id = $1 AND other.technical_account_id = credentials.technical_account_id
 AND other.organization_id <> credentials.organization_id)`;

const bindingSql = `SELECT binding.data_provider_id
FROM iam.mainserver_data_provider_bindings binding
WHERE binding.instance_id = $1 AND binding.principal_type = 'organization'
 AND binding.principal_id = $2::uuid AND binding.credential_fingerprint = $3
 AND binding.status = 'verified' AND binding.superseded_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM iam.mainserver_data_provider_bindings other
 WHERE other.instance_id = binding.instance_id AND other.id <> binding.id
 AND other.status IN ('verified', 'conflict') AND (
 (other.principal_type = 'organization' AND other.principal_id = binding.principal_id)
 OR other.data_provider_id = binding.data_provider_id))`;

const matchesMarker = (values: readonly string[] | undefined, expected: string): boolean =>
  values?.length === 1 && values[0] === expected;

const matchRemainingCredentials = (
  row: RecoveryRow,
  credentials: { apiKey: string; apiSecret: string }
): OrganizationCredentialRecoveryReason | undefined => {
  if (row.application_id?.trim() && row.application_id.trim() !== credentials.apiKey)
    return 'credential_version_mismatch';
  return undefined;
};

const commitRecovery = async (
  input: RecoveryInput,
  before: RecoveryRow,
  fingerprint: string,
  providerId: string,
  ciphertext: string,
  apiKey: string
): Promise<OrganizationCredentialRecoveryReason> => {
  const authorizationRevision = await input.reauthorize();
  if (!authorizationRevision) return 'principal_not_allowed';
  const params = [input.instanceId, input.organizationId, input.actorAccountId, input.actorSubject];
  return withInstanceScopedDb(input.instanceId, async (client) => {
    // Match the existing binding-writer lock order before locking credential/account rows.
    await lockMainserverDataProviderBindingScope(client, {
      instanceId: input.instanceId,
      principalType: 'organization',
      principalId: input.organizationId,
      credentialFingerprint: fingerprint,
      dataProviderId: providerId,
    });
    const current = (
      await client.query<RecoveryRow>(
        `${recoveryRowSql} FOR UPDATE OF credentials FOR SHARE OF account, organization, membership, actor;`,
        params
      )
    ).rows[0];
    if (!current || JSON.stringify(current) !== JSON.stringify(before)) return 'concurrent_change';
    const bindings = await client.query<{ data_provider_id: string }>(bindingSql, [
      input.instanceId,
      input.organizationId,
      fingerprint,
    ]);
    if (bindings.rows.length !== 1 || bindings.rows[0]?.data_provider_id !== providerId)
      return 'binding_not_verified';
    const currentRevision = await readPermissionRevisionVectorWithClient(
      client,
      input.instanceId,
      input.actorSubject,
      { lockForShare: true }
    );
    if (!revisionsEqual(currentRevision, authorizationRevision)) return 'principal_not_allowed';
    const result = await client.query(
      `UPDATE iam.organization_mainserver_credentials
SET mainserver_application_id = $3, mainserver_application_secret_ciphertext = $4,
 updated_by_account_id = $5::uuid, updated_at = NOW()
WHERE instance_id = $1 AND organization_id = $2::uuid AND provisioning_status = 'ready'
 AND technical_account_id = $6::uuid AND updated_at = $7::timestamptz;`,
      [
        input.instanceId,
        input.organizationId,
        apiKey,
        ciphertext,
        input.actorAccountId,
        before.technical_account_id,
        before.updated_at,
      ]
    );
    if (result.rowCount !== 1) return 'concurrent_change';
    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'organization.mainserver_credentials_restored',
      result: 'success',
      payload: {
        operation: 'restore_known_organization_credentials',
        organization_id: input.organizationId,
      },
      requestId: input.requestId,
    });
    return 'restored';
  });
};

export const restoreOrganizationMainserverCredentials = async (
  input: RecoveryInput
): Promise<OrganizationCredentialRecoveryReason> => {
  const params = [input.instanceId, input.organizationId, input.actorAccountId, input.actorSubject];
  try {
    const before = await withInstanceScopedDb(
      input.instanceId,
      async (client) => (await client.query<RecoveryRow>(recoveryRowSql, params)).rows[0]
    );
    if (!before) return 'organization_state_not_recoverable';
    const identity = await resolveIdentityProviderForInstance(input.instanceId, {
      executionMode: 'tenant_admin',
    });
    if (!identity) return 'keycloak_unavailable';
    let attributes: Awaited<ReturnType<typeof identity.provider.getUserAttributes>>;
    try {
      attributes = await identity.provider.getUserAttributes(before.keycloak_subject, [
        'instanceId',
        'organizationId',
        'accountPurpose',
        'mainserverUserApplicationId',
        'mainserverUserApplicationSecret',
      ]);
    } catch {
      return 'keycloak_unavailable';
    }
    if (
      !matchesMarker(attributes.instanceId, input.instanceId) ||
      !matchesMarker(attributes.organizationId, input.organizationId) ||
      !matchesMarker(attributes.accountPurpose, 'organization_mainserver')
    )
      return 'technical_account_mismatch';
    const candidate = resolveMainserverCredentialReadiness(attributes);
    if (candidate.status !== 'ready' || candidate.attributeSource !== 'canonical')
      return 'keycloak_credentials_incomplete';
    const remainingMismatch = matchRemainingCredentials(before, candidate.credentials);
    if (remainingMismatch) return remainingMismatch;
    const aad = `iam.organization_mainserver_credentials.mainserver_application_secret:${input.organizationId}`;
    if (before.secret_ciphertext) {
      const existingSecret = revealField(before.secret_ciphertext, aad);
      if (!existingSecret) return 'credential_decryption_failed';
      if (existingSecret !== candidate.credentials.apiSecret) return 'credential_version_mismatch';
    }
    const fingerprint = createMainserverCredentialFingerprint({
      instanceId: input.instanceId,
      source: 'organization',
      principalId: input.organizationId,
      credentials: candidate.credentials,
    });
    const providerId = await withInstanceScopedDb(input.instanceId, async (client) => {
      const bindings = await client.query<{ data_provider_id: string }>(bindingSql, [
        input.instanceId,
        input.organizationId,
        fingerprint,
      ]);
      return bindings.rows.length === 1 ? bindings.rows[0]?.data_provider_id : undefined;
    });
    if (!providerId) return 'binding_not_verified';
    let ciphertext: string | null;
    try {
      ciphertext = protectField(candidate.credentials.apiSecret, aad);
    } catch {
      return 'credential_encryption_unavailable';
    }
    if (!ciphertext?.startsWith('enc:v1:')) return 'credential_encryption_unavailable';
    return await commitRecovery(
      input,
      before,
      fingerprint,
      providerId,
      ciphertext,
      candidate.credentials.apiKey
    );
  } catch {
    return 'database_unavailable';
  }
};
