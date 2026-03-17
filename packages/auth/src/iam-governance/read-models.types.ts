import type { IamGovernanceCaseType } from '@sva/core';

export type GovernanceFilters = {
  readonly instanceId: string;
  readonly type?: IamGovernanceCaseType;
  readonly status?: string;
  readonly search?: string;
  readonly relatedAccountId?: string;
  readonly page: number;
  readonly pageSize: number;
};

export type PermissionChangeRow = {
  id: string;
  status: string;
  ticket_id: string | null;
  ticket_system: string | null;
  ticket_state: string | null;
  reason_code: string | null;
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  applied_at: string | null;
  updated_at: string;
  role_id: string;
  role_name: string;
  role_display_name: string | null;
  requester_account_id: string;
  target_account_id: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

export type DelegationRow = {
  id: string;
  status: string;
  ticket_id: string | null;
  ticket_system: string | null;
  ticket_state: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  role_id: string;
  role_name: string;
  role_display_name: string | null;
  delegator_account_id: string;
  delegatee_account_id: string;
  delegator_display_name_ciphertext: string | null;
  delegator_first_name_ciphertext: string | null;
  delegator_last_name_ciphertext: string | null;
  delegator_keycloak_subject: string;
  delegatee_display_name_ciphertext: string | null;
  delegatee_first_name_ciphertext: string | null;
  delegatee_last_name_ciphertext: string | null;
  delegatee_keycloak_subject: string;
};

export type ImpersonationRow = {
  id: string;
  status: string;
  ticket_id: string;
  ticket_system: string;
  ticket_state: string;
  reason_code: string | null;
  termination_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
  updated_at: string;
  actor_account_id: string;
  target_account_id: string;
  actor_display_name_ciphertext: string | null;
  actor_first_name_ciphertext: string | null;
  actor_last_name_ciphertext: string | null;
  actor_keycloak_subject: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

export type LegalAcceptanceRow = {
  id: string;
  legal_text_id: string;
  legal_text_version: string;
  locale: string;
  accepted_at: string;
  revoked_at: string | null;
  request_id: string | null;
  trace_id: string | null;
  account_id: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  keycloak_subject: string;
};
