import { describe, expect, it } from 'vitest';

import {
  governanceReadRoles,
  governanceWorkflowRoles,
  hasRequiredGovernanceRole,
  readGovernanceCaseType,
  readGovernanceOperation,
  requiresPrivilegedGovernanceWorkflowRole,
  validateGovernanceTicketState,
} from './governance-workflow-policy.js';

describe('governance-workflow-policy', () => {
  it('validates ticket state requirements', () => {
    expect(validateGovernanceTicketState(undefined)).toEqual({
      ok: false,
      reasonCode: 'DENY_TICKET_REQUIRED',
    });
    expect(validateGovernanceTicketState('closed')).toEqual({
      ok: false,
      reasonCode: 'DENY_TICKET_STATE_INVALID',
    });
    expect(validateGovernanceTicketState('approved_for_execution')).toEqual({ ok: true });
  });

  it('keeps legal text operations self-service while protecting privileged workflows', () => {
    expect(requiresPrivilegedGovernanceWorkflowRole('accept_legal_text')).toBe(false);
    expect(requiresPrivilegedGovernanceWorkflowRole('revoke_legal_acceptance')).toBe(false);
    expect(requiresPrivilegedGovernanceWorkflowRole('start_impersonation')).toBe(true);
  });

  it('checks governance role sets and case types', () => {
    expect(hasRequiredGovernanceRole(['support_admin'], governanceWorkflowRoles)).toBe(true);
    expect(hasRequiredGovernanceRole(['security_admin'], governanceWorkflowRoles)).toBe(false);
    expect(hasRequiredGovernanceRole(['security_admin'], governanceReadRoles)).toBe(true);
    expect(readGovernanceCaseType('delegation')).toBe('delegation');
    expect(readGovernanceCaseType('unknown')).toBeNull();
    expect(readGovernanceCaseType(undefined)).toBeUndefined();
  });

  it('reads only known governance operations', () => {
    expect(readGovernanceOperation('apply_permission_change')).toBe('apply_permission_change');
    expect(readGovernanceOperation('invalid')).toBeUndefined();
  });
});
