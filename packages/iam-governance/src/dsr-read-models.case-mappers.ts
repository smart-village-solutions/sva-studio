import type { IamDsrCanonicalStatus, IamDsrCaseListItem } from '@sva/core';

import { resolveGovernancePersonDisplayName, revealGovernanceField } from './person-display.js';
import type {
  ExportJobRow,
  LegalHoldRow,
  PersonColumns,
  ProfileCorrectionRow,
  RecipientNotificationRow,
  RequestRow,
} from './dsr-read-models.types.js';

export const readPersonName = (person: PersonColumns): string =>
  resolveGovernancePersonDisplayName({
    decryptedDisplayName: revealGovernanceField(
      person.display_name_ciphertext,
      `iam.accounts.display_name:${person.keycloak_subject}`
    ),
    firstName: revealGovernanceField(
      person.first_name_ciphertext,
      `iam.accounts.first_name:${person.keycloak_subject}`
    ),
    lastName: revealGovernanceField(
      person.last_name_ciphertext,
      `iam.accounts.last_name:${person.keycloak_subject}`
    ),
    keycloakSubject: person.keycloak_subject,
  });

export const toCanonicalDsrStatus = (status: string): IamDsrCanonicalStatus => {
  if (status === 'queued' || status === 'accepted') {
    return 'queued';
  }
  if (status === 'processing' || status === 'escalated') {
    return 'in_progress';
  }
  if (status === 'completed' || status === 'sent' || status === 'skipped') {
    return 'completed';
  }
  if (status === 'blocked_legal_hold') {
    return 'blocked';
  }
  return 'failed';
};

const readOptionalPersonName = (
  keycloakSubject: string | null,
  person: Omit<PersonColumns, 'keycloak_subject'>
): string | undefined =>
  keycloakSubject
    ? readPersonName({
        ...person,
        keycloak_subject: keycloakSubject,
      })
    : undefined;

export const mapRequestRow = (row: RequestRow): IamDsrCaseListItem => {
  const requesterDisplayName = readOptionalPersonName(row.requester_keycloak_subject, {
    display_name_ciphertext: row.requester_display_name_ciphertext,
    first_name_ciphertext: row.requester_first_name_ciphertext,
    last_name_ciphertext: row.requester_last_name_ciphertext,
  });
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });

  return {
    id: row.id,
    type: 'request',
    canonicalStatus: toCanonicalDsrStatus(row.status),
    rawStatus: row.status,
    title: row.request_type,
    summary: targetDisplayName,
    requestType: row.request_type,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    requesterAccountId: row.requester_account_id ?? undefined,
    requesterDisplayName,
    createdAt: row.request_accepted_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    blockedReason: row.legal_hold_blocked ? 'legal_hold' : undefined,
    metadata: {},
  };
};

export const mapExportJobRow = (row: ExportJobRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const requesterDisplayName = readOptionalPersonName(row.requester_keycloak_subject, {
    display_name_ciphertext: row.requester_display_name_ciphertext,
    first_name_ciphertext: row.requester_first_name_ciphertext,
    last_name_ciphertext: row.requester_last_name_ciphertext,
  });

  return {
    id: row.id,
    type: 'export_job',
    canonicalStatus: toCanonicalDsrStatus(row.status),
    rawStatus: row.status,
    title: 'export',
    summary: targetDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    requesterAccountId: row.requested_by_account_id ?? undefined,
    requesterDisplayName,
    format: row.format,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    metadata: {
      errorMessage: row.error_message ?? undefined,
    },
  };
};

export const mapLegalHoldRow = (row: LegalHoldRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const actorDisplayName = readOptionalPersonName(row.created_by_keycloak_subject, {
    display_name_ciphertext: row.created_by_display_name_ciphertext,
    first_name_ciphertext: row.created_by_first_name_ciphertext,
    last_name_ciphertext: row.created_by_last_name_ciphertext,
  });

  return {
    id: row.id,
    type: 'legal_hold',
    canonicalStatus: row.active ? 'blocked' : 'completed',
    rawStatus: row.active ? 'active' : 'released',
    title: 'legal_hold',
    summary: targetDisplayName,
    targetAccountId: row.account_id,
    targetDisplayName,
    actorAccountId: row.created_by_account_id ?? undefined,
    actorDisplayName,
    createdAt: row.created_at,
    completedAt: row.lifted_at ?? undefined,
    blockedReason: row.hold_reason,
    metadata: {
      holdUntil: row.hold_until ?? undefined,
      liftedByAccountId: row.lifted_by_account_id ?? undefined,
    },
  };
};

export const mapProfileCorrectionRow = (row: ProfileCorrectionRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const actorDisplayName = readOptionalPersonName(row.actor_keycloak_subject, {
    display_name_ciphertext: row.actor_display_name_ciphertext,
    first_name_ciphertext: row.actor_first_name_ciphertext,
    last_name_ciphertext: row.actor_last_name_ciphertext,
  });

  return {
    id: row.id,
    type: 'profile_correction',
    canonicalStatus: 'completed',
    rawStatus: 'completed',
    title: 'profile_correction',
    summary: targetDisplayName,
    targetAccountId: row.account_id,
    targetDisplayName,
    actorAccountId: row.actor_account_id ?? undefined,
    actorDisplayName,
    createdAt: row.created_at,
    completedAt: row.created_at,
    metadata: {
      correctionReason: row.correction_reason ?? undefined,
    },
  };
};

export const mapRecipientNotificationRow = (row: RecipientNotificationRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });

  return {
    id: row.id,
    type: 'recipient_notification',
    canonicalStatus: toCanonicalDsrStatus(row.notification_status),
    rawStatus: row.notification_status,
    title: row.recipient_class,
    summary: targetDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    createdAt: row.created_at,
    completedAt: row.notified_at ?? undefined,
    metadata: {
      requestId: row.request_id,
      notificationResult: row.notification_result ?? undefined,
    },
  };
};
