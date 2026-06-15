import type {
  InstanceAuditEvent,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceProvisioningOperation,
  InstanceRealmMode,
  InstanceStatus,
} from '@sva/core';

export type InstanceListRow = {
  instance_id: string;
  display_name: string;
  status: InstanceStatus;
  parent_domain: string;
  primary_hostname: string;
  realm_mode: InstanceRealmMode;
  auth_realm: string;
  auth_client_id: string;
  auth_issuer_url: string | null;
  auth_client_secret_ciphertext: string | null;
  tenant_admin_client_id: string | null;
  tenant_admin_client_secret_ciphertext: string | null;
  tenant_admin_username: string | null;
  tenant_admin_email: string | null;
  tenant_admin_first_name: string | null;
  tenant_admin_last_name: string | null;
  theme_key: string | null;
  assigned_module_ids: readonly string[] | null;
  feature_flags: Record<string, boolean> | null;
  mainserver_config_ref: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type ProvisioningRow = {
  id: string;
  instance_id: string;
  operation: InstanceProvisioningOperation;
  status: InstanceStatus;
  step_key: string | null;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  request_id: string | null;
  actor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditRow = {
  id: string;
  instance_id: string;
  event_type: InstanceAuditEvent['eventType'];
  actor_id: string | null;
  request_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type KeycloakProvisioningRunRow = {
  id: string;
  instance_id: string;
  mutation: InstanceKeycloakProvisioningRun['mutation'] | null;
  idempotency_key: string | null;
  payload_fingerprint: string | null;
  mode: InstanceRealmMode;
  intent: InstanceKeycloakProvisioningRun['intent'];
  overall_status: InstanceKeycloakProvisioningRun['overallStatus'];
  drift_summary: string;
  request_id: string | null;
  actor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatedKeycloakProvisioningRunRow = KeycloakProvisioningRunRow & {
  created: boolean;
};

export type KeycloakProvisioningStepRow = {
  id: string;
  run_id: string;
  step_key: string;
  title: string;
  status: InstanceKeycloakProvisioningRunStep['status'];
  started_at: string | null;
  finished_at: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
};
