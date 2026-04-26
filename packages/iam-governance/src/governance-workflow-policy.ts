import type { IamGovernanceCaseType } from '@sva/core';

import { readString } from './input-readers.js';

export type GovernanceOperation =
  | 'submit_permission_change'
  | 'approve_permission_change'
  | 'apply_permission_change'
  | 'create_delegation'
  | 'revoke_delegation'
  | 'start_impersonation'
  | 'end_impersonation'
  | 'accept_legal_text'
  | 'revoke_legal_acceptance';

export const governanceWorkflowRoles = new Set(['iam_admin', 'support_admin', 'system_admin']);

export const governanceReadRoles = new Set([
  'iam_admin',
  'support_admin',
  'system_admin',
  'security_admin',
  'compliance_officer',
]);

export const governanceComplianceExportRoles = new Set([
  'iam_admin',
  'system_admin',
  'security_admin',
  'compliance_officer',
]);

const ALLOWED_TICKET_STATES = new Set(['open', 'in_progress', 'approved_for_execution']);
const GOVERNANCE_CASE_TYPES = new Set<IamGovernanceCaseType>([
  'permission_change',
  'delegation',
  'impersonation',
  'legal_acceptance',
]);

export const validateGovernanceTicketState = (
  ticketState: string | undefined
): { ok: true } | { ok: false; reasonCode: 'DENY_TICKET_REQUIRED' | 'DENY_TICKET_STATE_INVALID' } => {
  if (!ticketState) {
    return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };
  }
  if (!ALLOWED_TICKET_STATES.has(ticketState)) {
    return { ok: false, reasonCode: 'DENY_TICKET_STATE_INVALID' };
  }
  return { ok: true };
};

export const hasRequiredGovernanceRole = (
  userRoles: readonly string[],
  allowedRoles: ReadonlySet<string>
): boolean => userRoles.some((role) => allowedRoles.has(role));

export const requiresPrivilegedGovernanceWorkflowRole = (operation: GovernanceOperation): boolean => {
  if (operation === 'accept_legal_text' || operation === 'revoke_legal_acceptance') {
    return false;
  }
  return true;
};

export const readGovernanceCaseType = (
  value: string | undefined
): IamGovernanceCaseType | undefined | null => {
  if (!value) {
    return undefined;
  }
  return GOVERNANCE_CASE_TYPES.has(value as IamGovernanceCaseType) ? (value as IamGovernanceCaseType) : null;
};

export const readGovernanceOperation = (value: unknown): GovernanceOperation | undefined => {
  const operation = readString(value) as GovernanceOperation | undefined;
  if (!operation) {
    return undefined;
  }
  return [
    'submit_permission_change',
    'approve_permission_change',
    'apply_permission_change',
    'create_delegation',
    'revoke_delegation',
    'start_impersonation',
    'end_impersonation',
    'accept_legal_text',
    'revoke_legal_acceptance',
  ].includes(operation)
    ? operation
    : undefined;
};
