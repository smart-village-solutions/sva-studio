import type {
  InstanceAuditEvent,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
} from '@sva/core';

import type {
  AuditRow,
  InstanceListRow,
  KeycloakProvisioningRunRow,
  KeycloakProvisioningStepRow,
  ProvisioningRow,
} from './repository-types.js';

export const mapInstance = (row: InstanceListRow): InstanceRegistryRecord => ({
  instanceId: row.instance_id,
  displayName: row.display_name,
  status: row.status,
  parentDomain: row.parent_domain,
  primaryHostname: row.primary_hostname,
  realmMode: row.realm_mode,
  authRealm: row.auth_realm,
  authClientId: row.auth_client_id,
  authIssuerUrl: row.auth_issuer_url ?? undefined,
  authClientSecretConfigured: Boolean(row.auth_client_secret_ciphertext),
  tenantAdminClient: row.tenant_admin_client_id
    ? {
        clientId: row.tenant_admin_client_id,
        secretConfigured: Boolean(row.tenant_admin_client_secret_ciphertext),
      }
    : undefined,
  tenantAdminBootstrap: row.tenant_admin_username
    ? {
        username: row.tenant_admin_username,
        email: row.tenant_admin_email ?? undefined,
        firstName: row.tenant_admin_first_name ?? undefined,
        lastName: row.tenant_admin_last_name ?? undefined,
      }
    : undefined,
  themeKey: row.theme_key ?? undefined,
  assignedModules: row.assigned_module_ids ?? [],
  featureFlags: row.feature_flags ?? {},
  mainserverConfigRef: row.mainserver_config_ref ?? undefined,
  createdAt: row.created_at,
  createdBy: row.created_by ?? undefined,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by ?? undefined,
});

export const mapProvisioningRun = (row: ProvisioningRow): InstanceProvisioningRun => ({
  id: row.id,
  instanceId: row.instance_id,
  operation: row.operation,
  status: row.status,
  stepKey: row.step_key ?? undefined,
  idempotencyKey: row.idempotency_key,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  requestId: row.request_id ?? undefined,
  actorId: row.actor_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapAuditEvent = (row: AuditRow): InstanceAuditEvent => ({
  id: row.id,
  instanceId: row.instance_id,
  eventType: row.event_type,
  actorId: row.actor_id ?? undefined,
  requestId: row.request_id ?? undefined,
  details: row.details ?? {},
  createdAt: row.created_at,
});

export const mapKeycloakProvisioningRunStep = (
  row: KeycloakProvisioningStepRow
): InstanceKeycloakProvisioningRunStep => ({
  stepKey: row.step_key,
  title: row.title,
  status: row.status,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  summary: row.summary,
  details: row.details ?? {},
  requestId: row.request_id ?? undefined,
});

export const mapKeycloakProvisioningRun = (
  row: KeycloakProvisioningRunRow,
  steps: readonly KeycloakProvisioningStepRow[]
): InstanceKeycloakProvisioningRun => ({
  id: row.id,
  instanceId: row.instance_id,
  ...(row.mutation ? { mutation: row.mutation } : {}),
  ...(row.idempotency_key ? { idempotencyKey: row.idempotency_key } : {}),
  ...(row.payload_fingerprint ? { payloadFingerprint: row.payload_fingerprint } : {}),
  mode: row.mode,
  intent: row.intent,
  overallStatus: row.overall_status,
  driftSummary: row.drift_summary,
  requestId: row.request_id ?? undefined,
  actorId: row.actor_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  steps: steps.map(mapKeycloakProvisioningRunStep),
});
