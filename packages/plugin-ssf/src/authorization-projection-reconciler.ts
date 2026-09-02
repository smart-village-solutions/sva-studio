import {
  normalizeSsfAuthorizationProjection,
  type SsfAuthorizationProjection,
} from './authorization-projection.js';
import type { SsfAuthorizationProjectionState } from './authorization-projection-repository.js';

export interface SsfAuthorizationProjectionLockedStore {
  stage(projection: SsfAuthorizationProjection): Promise<SsfAuthorizationProjectionState>;
  claim(input: {
    instanceId: string;
    generation: number;
    desiredRevision: string;
  }): Promise<boolean>;
  confirmReadBack(input: {
    desired: SsfAuthorizationProjection;
    readBack: SsfAuthorizationProjection;
    generation: number;
  }): Promise<boolean>;
  markSessionsRevoked(input: {
    instanceId: string;
    generation: number;
    authorizationRevision: string;
  }): Promise<boolean>;
  markBlocked(input: {
    instanceId: string;
    generation: number;
    desiredRevision: string;
    errorCode: string;
  }): Promise<boolean>;
}

export interface SsfAuthorizationProjectionStore {
  withTenantLock<T>(
    instanceId: string,
    operation: (store: SsfAuthorizationProjectionLockedStore) => Promise<T>
  ): Promise<T>;
}

export interface SsfAuthorizationProjectionTarget {
  suspendTokenIssuance(instanceId: string): Promise<void>;
  reconcile(projection: SsfAuthorizationProjection, authorizationRevision: string): Promise<void>;
  readBack(instanceId: string): Promise<SsfAuthorizationProjection>;
  revokeTenantSessions(instanceId: string): Promise<void>;
  resumeTokenIssuance(instanceId: string): Promise<void>;
}

export type SsfAuthorizationProjectionReconcileResult =
  | Readonly<{
      status: 'ready';
      authorizationRevision: string;
      generation: number;
      changed: boolean;
    }>
  | Readonly<{
      status: 'busy' | 'stale';
      generation: number;
    }>
  | Readonly<{
      status: 'blocked';
      generation: number;
      reason:
        | 'token_issuance_suspend_failed'
        | 'target_write_failed'
        | 'target_readback_failed'
        | 'target_readback_mismatch'
        | 'session_revocation_failed'
        | 'token_issuance_resume_failed';
    }>;

class SsfProjectionPhaseError extends Error {
  constructor(
    readonly reason:
      | 'token_issuance_suspend_failed'
      | 'target_write_failed'
      | 'target_readback_failed'
      | 'session_revocation_failed'
      | 'token_issuance_resume_failed'
  ) {
    super(reason);
    this.name = 'SsfProjectionPhaseError';
  }
}

export const createSsfAuthorizationProjectionReconciler =
  (dependencies: {
    readonly store: SsfAuthorizationProjectionStore;
    readonly target: SsfAuthorizationProjectionTarget;
  }) =>
  async (
    desired: SsfAuthorizationProjection
  ): Promise<SsfAuthorizationProjectionReconcileResult> => {
    const normalizedDesired = normalizeSsfAuthorizationProjection(desired);
    return dependencies.store.withTenantLock(normalizedDesired.instanceId, async (store) => {
      const staged = await store.stage(normalizedDesired);
      if (
        staged.status === 'ready' &&
        staged.confirmedRevision === staged.desiredRevision &&
        staged.sessionsRevokedRevision === staged.desiredRevision
      ) {
        return {
          status: 'ready',
          authorizationRevision: staged.desiredRevision,
          generation: staged.generation,
          changed: false,
        };
      }

      const claimed = await store.claim({
        instanceId: staged.instanceId,
        generation: staged.generation,
        desiredRevision: staged.desiredRevision,
      });
      if (!claimed) return { status: 'busy', generation: staged.generation };

      let readBack: SsfAuthorizationProjection;
      try {
        try {
          await dependencies.target.suspendTokenIssuance(staged.instanceId);
        } catch {
          throw new SsfProjectionPhaseError('token_issuance_suspend_failed');
        }
        try {
          await dependencies.target.reconcile(staged.desiredProjection, staged.desiredRevision);
        } catch {
          throw new SsfProjectionPhaseError('target_write_failed');
        }
        try {
          readBack = await dependencies.target.readBack(staged.instanceId);
        } catch {
          throw new SsfProjectionPhaseError('target_readback_failed');
        }

        const confirmed = await store.confirmReadBack({
          desired: staged.desiredProjection,
          readBack,
          generation: staged.generation,
        });
        if (!confirmed) {
          return {
            status: 'blocked',
            generation: staged.generation,
            reason: 'target_readback_mismatch',
          };
        }

        try {
          await dependencies.target.revokeTenantSessions(staged.instanceId);
        } catch {
          throw new SsfProjectionPhaseError('session_revocation_failed');
        }
        try {
          await dependencies.target.resumeTokenIssuance(staged.instanceId);
        } catch {
          throw new SsfProjectionPhaseError('token_issuance_resume_failed');
        }
        const published = await store.markSessionsRevoked({
          instanceId: staged.instanceId,
          generation: staged.generation,
          authorizationRevision: staged.desiredRevision,
        });
        if (!published) return { status: 'stale', generation: staged.generation };

        return {
          status: 'ready',
          authorizationRevision: staged.desiredRevision,
          generation: staged.generation,
          changed: true,
        };
      } catch (error) {
        const reason =
          error instanceof SsfProjectionPhaseError ? error.reason : 'target_write_failed';
        await store.markBlocked({
          instanceId: staged.instanceId,
          generation: staged.generation,
          desiredRevision: staged.desiredRevision,
          errorCode: reason,
        });
        return { status: 'blocked', generation: staged.generation, reason };
      }
    });
  };
