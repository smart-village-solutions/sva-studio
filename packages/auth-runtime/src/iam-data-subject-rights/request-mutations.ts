import { appendDsrRequestEvent, isDsrLegalHoldActive } from '@sva/iam-governance/dsr-persistence';
import type { QueryClient } from '../db.js';
import { readString } from '../shared/input-readers.js';
import {
  DELETE_SLA_HOURS,
  resolveRetentionHours,
  type DsrRequestMutationResult,
} from './shared.js';
import { createDsrRequest, ensureArt19RecipientRows } from './persistence.js';

export const performDeletionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    keycloakSubject: string;
    payload: Record<string, unknown>;
  }
): Promise<DsrRequestMutationResult> => {
  const hasLegalHold = await isDsrLegalHoldActive(client, {
    instanceId: input.instanceId,
    accountId: input.targetAccountId,
  });

  if (hasLegalHold) {
    const blockedRequestId = await createDsrRequest(client, {
      instanceId: input.instanceId,
      requestType: 'deletion',
      status: 'blocked_legal_hold',
      requesterAccountId: input.requesterAccountId,
      targetAccountId: input.targetAccountId,
      payload: input.payload,
      legalHoldBlocked: true,
      slaDeadlineAt: new Date(Date.now() + DELETE_SLA_HOURS * 60 * 60 * 1000).toISOString(),
    });

    await appendDsrRequestEvent(client, {
      instanceId: input.instanceId,
      requestId: blockedRequestId,
      actorAccountId: input.requesterAccountId,
      eventType: 'deletion_blocked_legal_hold',
      payload: {},
    });

    return {
      requestId: blockedRequestId,
      status: 'blocked_legal_hold',
    };
  }

  const retentionHours = resolveRetentionHours();
  await client.query(
    `
UPDATE iam.accounts
SET
  is_blocked = true,
  soft_deleted_at = NOW(),
  delete_after = NOW() + ($3::int * INTERVAL '1 hour'),
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId, retentionHours]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'deletion',
    status: 'processing',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: {
      ...input.payload,
      retentionHours,
    },
    slaDeadlineAt: new Date(Date.now() + DELETE_SLA_HOURS * 60 * 60 * 1000).toISOString(),
  });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'soft_deleted',
    payload: {
      retentionHours,
      slaHours: DELETE_SLA_HOURS,
    },
  });

  return {
    requestId,
    status: 'processing',
    afterCommitRevocation: {
      keycloakSubject: input.keycloakSubject,
      reason: 'dsr_deletion_requested' as const,
    },
  };
};

export const performRestrictionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
  }
): Promise<DsrRequestMutationResult> => {
  const reason = readString(input.payload.reason) ?? 'restriction_requested';
  await client.query(
    `
UPDATE iam.accounts
SET
  processing_restricted_at = NOW(),
  processing_restriction_reason = $3,
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId, reason]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'restriction',
    status: 'completed',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: {
      reason,
    },
    completedAt: new Date().toISOString(),
  });

  await ensureArt19RecipientRows(client, { instanceId: input.instanceId, requestId });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'processing_restricted',
    payload: {
      reason,
    },
  });

  return { requestId, status: 'completed' };
};

export const performObjectionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
  }
): Promise<DsrRequestMutationResult> => {
  await client.query(
    `
UPDATE iam.accounts
SET
  non_essential_processing_opt_out_at = NOW(),
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'objection',
    status: 'completed',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: input.payload,
    completedAt: new Date().toISOString(),
  });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'non_essential_processing_opt_out',
    payload: input.payload,
  });

  return { requestId, status: 'completed' };
};
