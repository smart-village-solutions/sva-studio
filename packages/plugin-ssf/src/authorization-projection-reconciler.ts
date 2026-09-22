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
  markReady(input: {
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

export type SsfAuthorizationProjectionInput =
  | SsfAuthorizationProjection
  | Readonly<{
      instanceId: string;
      readDesired: () => Promise<SsfAuthorizationProjection>;
    }>;

export interface SsfAuthorizationProjectionTarget {
  prepareLoginClients(instanceId: string): Promise<void>;
  prepareRuntimeBaseline(instanceId: string): Promise<void>;
  isReady(instanceId: string, authorizationRevision: string): Promise<boolean>;
  suspendTokenIssuance(instanceId: string): Promise<void>;
  reconcile(projection: SsfAuthorizationProjection, authorizationRevision: string): Promise<void>;
  readBack(instanceId: string): Promise<SsfAuthorizationProjection>;
  revokeTenantSessions(instanceId: string, authorizationRevision: string): Promise<void>;
  resumeTokenIssuance(instanceId: string): Promise<void>;
}

type SsfProjectionFailureReason =
  | 'login_client_preparation_failed'
  | 'runtime_baseline_preparation_failed'
  | 'tenant_instance_id_invalid'
  | 'tenant_readiness_failed'
  | 'token_issuance_suspend_failed'
  | 'target_integrity_failed'
  | 'target_write_failed'
  | 'target_readback_failed'
  | 'target_readback_mismatch'
  | 'token_issuance_resume_failed';

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
      reason: SsfProjectionFailureReason;
    }>;

class SsfProjectionPhaseError extends Error {
  constructor(readonly reason: SsfProjectionFailureReason) {
    super(reason);
    this.name = 'SsfProjectionPhaseError';
  }
}

type SsfAuthorizationProjectionReconcilerDependencies = Readonly<{
  store: SsfAuthorizationProjectionStore;
  target: SsfAuthorizationProjectionTarget;
}>;

const isTargetIntegrityFailure = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'user_profile_preservation_readback_mismatch';

const prepareRuntimeBaseline = async (
  target: SsfAuthorizationProjectionTarget,
  instanceId: string
): Promise<void> => {
  try {
    await target.prepareRuntimeBaseline(instanceId);
  } catch (error) {
    throw new SsfProjectionPhaseError(
      error instanceof Error && error.message === 'ssf_tenant_instance_id_invalid'
        ? 'tenant_instance_id_invalid'
        : 'runtime_baseline_preparation_failed'
    );
  }
};

const prepareLoginClients = async (
  target: SsfAuthorizationProjectionTarget,
  instanceId: string
): Promise<void> => {
  try {
    await target.prepareLoginClients(instanceId);
  } catch {
    throw new SsfProjectionPhaseError('login_client_preparation_failed');
  }
};

const requireTenantReadiness = async (
  target: SsfAuthorizationProjectionTarget,
  instanceId: string,
  desiredRevision: string
): Promise<void> => {
  try {
    if (await target.isReady(instanceId, desiredRevision)) return;
  } catch {
    // The same stable phase error applies to a negative and a rejected readiness probe.
  }
  throw new SsfProjectionPhaseError('tenant_readiness_failed');
};

const reconcileClaimedProjection = async (
  dependencies: SsfAuthorizationProjectionReconcilerDependencies,
  store: SsfAuthorizationProjectionLockedStore,
  staged: SsfAuthorizationProjectionState
): Promise<SsfAuthorizationProjectionReconcileResult> => {
  let readBack: SsfAuthorizationProjection;
  try {
    try {
      await dependencies.target.suspendTokenIssuance(staged.instanceId);
    } catch {
      throw new SsfProjectionPhaseError('token_issuance_suspend_failed');
    }
    await prepareLoginClients(dependencies.target, staged.instanceId);
    try {
      await dependencies.target.reconcile(staged.desiredProjection, staged.desiredRevision);
    } catch (error) {
      throw new SsfProjectionPhaseError(
        isTargetIntegrityFailure(error) ? 'target_integrity_failed' : 'target_write_failed'
      );
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

    await prepareRuntimeBaseline(dependencies.target, staged.instanceId);

    try {
      await dependencies.target.resumeTokenIssuance(staged.instanceId);
    } catch {
      throw new SsfProjectionPhaseError('token_issuance_resume_failed');
    }
    await requireTenantReadiness(dependencies.target, staged.instanceId, staged.desiredRevision);
    const published = await store.markReady({
      instanceId: staged.instanceId,
      generation: staged.generation,
      authorizationRevision: staged.desiredRevision,
    });
    if (!published) {
      await dependencies.target.suspendTokenIssuance(staged.instanceId);
      return { status: 'stale', generation: staged.generation };
    }

    return {
      status: 'ready',
      authorizationRevision: staged.desiredRevision,
      generation: staged.generation,
      changed: true,
    };
  } catch (error) {
    // Re-close the browser client after failures during activation or read-back.
    // A failed compensation still leaves the persistent projection blocked.
    await dependencies.target.suspendTokenIssuance(staged.instanceId).catch(() => undefined);
    const reason = error instanceof SsfProjectionPhaseError ? error.reason : 'target_write_failed';
    await store.markBlocked({
      instanceId: staged.instanceId,
      generation: staged.generation,
      desiredRevision: staged.desiredRevision,
      errorCode: reason,
    });
    return { status: 'blocked', generation: staged.generation, reason };
  }
};

const reconcileLockedProjection = async (
  dependencies: SsfAuthorizationProjectionReconcilerDependencies,
  store: SsfAuthorizationProjectionLockedStore,
  desired: SsfAuthorizationProjection
): Promise<SsfAuthorizationProjectionReconcileResult> => {
  const staged = await store.stage(desired);
  if (
    staged.status === 'ready' &&
    staged.confirmedRevision === staged.desiredRevision &&
    (await dependencies.target
      .isReady(staged.instanceId, staged.desiredRevision)
      .catch(() => false))
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
  return claimed
    ? reconcileClaimedProjection(dependencies, store, staged)
    : { status: 'busy', generation: staged.generation };
};

export const createSsfAuthorizationProjectionReconciler =
  (dependencies: SsfAuthorizationProjectionReconcilerDependencies) =>
  async (
    input: SsfAuthorizationProjectionInput
  ): Promise<SsfAuthorizationProjectionReconcileResult> => {
    const directDesired =
      'readDesired' in input ? undefined : normalizeSsfAuthorizationProjection(input);
    const instanceId = directDesired?.instanceId ?? input.instanceId;
    return dependencies.store.withTenantLock(instanceId, async (store) => {
      const desired = 'readDesired' in input ? await input.readDesired() : directDesired!;
      const normalizedDesired = normalizeSsfAuthorizationProjection(desired);
      if (normalizedDesired.instanceId !== instanceId) {
        throw new Error('ssf_authorization_projection_tenant_mismatch');
      }
      return reconcileLockedProjection(dependencies, store, normalizedDesired);
    });
  };
