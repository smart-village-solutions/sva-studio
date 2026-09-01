import {
  recordMainserverDataProviderObservation,
  resolveMainserverOwnershipTarget,
  type MainserverOwnershipVerificationCandidate,
  type ResolveMainserverOwnershipTargetResult,
} from '@sva/auth-runtime/server';
import type { IamContentOwnerPrincipal } from '@sva/core';

import { errorJson } from './content-route-core.js';
import { recordOwnershipTransferOutcome } from './content-ownership-telemetry.js';
import { SvaMainserverError } from './errors.js';
import { finalizeMainserverMutation, type MainserverMutationActor } from './mutation-principal.js';
import { loadSvaMainserverDataProviderIdentity } from './service.js';

const verifyMissingTargetBinding = async (candidate: MainserverOwnershipVerificationCandidate) => {
  const identity = await loadSvaMainserverDataProviderIdentity(candidate.connection);
  return recordMainserverDataProviderObservation({
    instanceId: candidate.connection.instanceId,
    principalType: candidate.connection.actingPrincipalType,
    principalId: candidate.principal.id,
    credentialFingerprint: candidate.connection.credentialFingerprint,
    dataProviderId: identity.dataProvider.id,
    ...(identity.dataProvider.name ? { dataProviderName: identity.dataProvider.name } : {}),
    evidenceKind: 'identity_endpoint',
  });
};

export const resolveTransferTarget = async (input: {
  actor: MainserverMutationActor;
  principal: IamContentOwnerPrincipal;
}) => {
  const initial = await resolveMainserverOwnershipTarget({
    instanceId: input.actor.instanceId,
    actorKeycloakSubject: input.actor.keycloakSubject,
    principal: input.principal,
  });
  if (initial.ok || initial.code !== 'content_transfer_target_binding_missing') return initial;

  const observation = await verifyMissingTargetBinding(initial.verificationCandidate);
  if (observation.outcome === 'conflict') {
    return { ok: false, code: 'content_transfer_target_binding_conflict' } as const;
  }
  return resolveMainserverOwnershipTarget({
    instanceId: input.actor.instanceId,
    actorKeycloakSubject: input.actor.keycloakSubject,
    principal: input.principal,
  });
};

const targetVerificationFailureStatus = (error: unknown): number =>
  error instanceof SvaMainserverError && (error.statusCode ?? 500) < 500 ? 409 : 503;

export const resolveTargetForMutation = async (input: {
  actor: MainserverMutationActor;
  contentType: string;
  contentId: string;
  principal: IamContentOwnerPrincipal;
  sourceDataProviderId: string;
}): Promise<ResolveMainserverOwnershipTargetResult | Response> => {
  try {
    return await resolveTransferTarget({ actor: input.actor, principal: input.principal });
  } catch (error) {
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.contentType,
      outcome: 'rejected',
      errorCode: 'content_transfer_target_verification_failed',
    });
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'failed',
      reconciliationStatus: 'complete',
      completedSteps: ['target_identity_verification_failed'],
      contentId: input.contentId,
      observedDataProviderId: input.sourceDataProviderId,
      lastErrorCode: 'content_transfer_target_verification_failed',
    });
    return errorJson(
      targetVerificationFailureStatus(error),
      'content_transfer_target_verification_failed',
      'Die DataProvider-Zuordnung des Zielinhabers konnte nicht bestätigt werden.'
    );
  }
};
