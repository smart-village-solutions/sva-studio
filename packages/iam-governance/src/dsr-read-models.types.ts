import type {
  IamDsrCanonicalStatus,
  IamDsrCaseListItem,
} from '@sva/core';

export type PersonColumns = {
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  keycloak_subject: string;
};

export type DsrFilters = {
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly type?: IamDsrCaseListItem['type'];
  readonly status?: IamDsrCanonicalStatus;
  readonly relatedAccountId?: string;
};

export type AccountSnapshotRow = {
  id: string;
  processing_restricted_at: string | null;
  processing_restriction_reason: string | null;
  non_essential_processing_opt_out_at: string | null;
};

export type RequestRow = {
  id: string;
  request_type: string;
  status: string;
  requester_account_id: string | null;
  target_account_id: string;
  legal_hold_blocked: boolean;
  request_accepted_at: string;
  completed_at: string | null;
  updated_at: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

export type ExportJobRow = {
  id: string;
  format: string;
  status: string;
  error_message: string | null;
  target_account_id: string;
  requested_by_account_id: string | null;
  created_at: string;
  completed_at: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string | null;
};

export type LegalHoldRow = {
  id: string;
  active: boolean;
  hold_reason: string;
  hold_until: string | null;
  account_id: string;
  created_by_account_id: string | null;
  lifted_by_account_id: string | null;
  created_at: string;
  lifted_at: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  created_by_display_name_ciphertext: string | null;
  created_by_first_name_ciphertext: string | null;
  created_by_last_name_ciphertext: string | null;
  created_by_keycloak_subject: string | null;
};

export type ProfileCorrectionRow = {
  id: string;
  account_id: string;
  actor_account_id: string | null;
  correction_reason: string | null;
  created_at: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  actor_display_name_ciphertext: string | null;
  actor_first_name_ciphertext: string | null;
  actor_last_name_ciphertext: string | null;
  actor_keycloak_subject: string | null;
};

export type RecipientNotificationRow = {
  id: string;
  request_id: string;
  recipient_class: string;
  notification_status: string;
  notification_result: string | null;
  created_at: string;
  notified_at: string | null;
  target_account_id: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

export type DsrSelfServiceRows = {
  account: AccountSnapshotRow;
  requests: readonly RequestRow[];
  exportJobs: readonly ExportJobRow[];
  legalHolds: readonly LegalHoldRow[];
};

export type AdminDsrSourceRows = {
  requests: readonly RequestRow[];
  exportJobs: readonly ExportJobRow[];
  legalHolds: readonly LegalHoldRow[];
  profileCorrections: readonly ProfileCorrectionRow[];
  recipientNotifications: readonly RecipientNotificationRow[];
};
