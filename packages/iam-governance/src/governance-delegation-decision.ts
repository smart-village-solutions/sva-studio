import { readString } from './input-readers.js';
import { validateGovernanceTicketState } from './governance-workflow-policy.js';

const MAX_DELEGATION_DAYS = 30;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

type DelegationPayload = Readonly<{
  delegatorSubject: string;
  delegateeSubject?: string;
  roleId?: string;
  approverSubject?: string;
  ticketId?: string;
  ticketState?: string;
  startsAt?: string;
  endsAt?: string;
}>;

type DelegationDecision = Readonly<{
  delegatorSubject: string;
  delegateeSubject: string;
  roleId: string;
  approverSubject: string;
  ticketId: string;
  ticketState: string;
  startDate: Date;
  endDate: Date;
}>;

type DelegationDecisionResult =
  | Readonly<{ ok: true; value: DelegationDecision }>
  | Readonly<{
      ok: false;
      reasonCode: 'invalid_request' | 'DENY_TICKET_REQUIRED' | 'DENY_TICKET_STATE_INVALID' | 'DENY_DELEGATION_DURATION_EXCEEDED';
    }>;

export const normalizeDelegationPayload = (
  payload: Record<string, unknown>,
  actorSubject: string
): DelegationPayload => ({
  delegatorSubject: readString(payload.delegatorKeycloakSubject) ?? actorSubject,
  delegateeSubject: readString(payload.delegateeKeycloakSubject),
  roleId: readString(payload.roleId),
  approverSubject: readString(payload.approverKeycloakSubject),
  ticketId: readString(payload.ticketId),
  ticketState: readString(payload.ticketState),
  startsAt: readString(payload.startsAt),
  endsAt: readString(payload.endsAt),
});

export const resolveDelegationDecision = (
  input: DelegationPayload,
  isUuid: (value: string) => boolean
): DelegationDecisionResult => {
  if (
    !input.delegateeSubject ||
    !input.roleId ||
    !isUuid(input.roleId) ||
    !input.approverSubject ||
    !input.startsAt ||
    !input.endsAt ||
    !input.ticketId
  ) {
    return { ok: false, reasonCode: 'invalid_request' };
  }

  if (!input.ticketState) {
    return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };
  }
  const ticketValidation = validateGovernanceTicketState(input.ticketState);
  if (!ticketValidation.ok) {
    return ticketValidation;
  }

  const startDate = new Date(input.startsAt);
  const endDate = new Date(input.endsAt);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return { ok: false, reasonCode: 'invalid_request' };
  }

  const durationDays = (endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY;
  if (durationDays <= 0 || durationDays > MAX_DELEGATION_DAYS) {
    return { ok: false, reasonCode: 'DENY_DELEGATION_DURATION_EXCEEDED' };
  }

  return {
    ok: true,
    value: {
      delegatorSubject: input.delegatorSubject,
      delegateeSubject: input.delegateeSubject,
      roleId: input.roleId,
      approverSubject: input.approverSubject,
      ticketId: input.ticketId,
      ticketState: input.ticketState,
      startDate,
      endDate,
    },
  };
};

export const resolveDelegationStatus = (startDate: Date, now: number): 'active' | 'requested' =>
  startDate.getTime() <= now ? 'active' : 'requested';

type DelegationAccountDecision =
  | Readonly<{
      ok: true;
      value: Readonly<{
        delegatorAccountId: string;
        delegateeAccountId: string;
        approverAccountId: string;
      }>;
    }>
  | Readonly<{ ok: false; reasonCode: 'unauthorized' | 'DENY_SELF_APPROVAL' }>;

export const resolveDelegationAccountDecision = (input: {
  delegatorAccountId?: string;
  delegateeAccountId?: string;
  approverAccountId?: string;
}): DelegationAccountDecision => {
  if (!input.delegatorAccountId || !input.delegateeAccountId || !input.approverAccountId) {
    return { ok: false, reasonCode: 'unauthorized' };
  }
  if (input.delegatorAccountId === input.approverAccountId) {
    return { ok: false, reasonCode: 'DENY_SELF_APPROVAL' };
  }
  return {
    ok: true,
    value: {
      delegatorAccountId: input.delegatorAccountId,
      delegateeAccountId: input.delegateeAccountId,
      approverAccountId: input.approverAccountId,
    },
  };
};
