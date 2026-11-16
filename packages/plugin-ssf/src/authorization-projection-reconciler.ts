import {
  areSsfAuthorizationProjectionsEqual,
  normalizeSsfAuthorizationProjection,
  type SsfAuthorizationProjection,
} from './authorization-projection.js';
import type { SsfAuthorizationProjectionState } from './authorization-projection-repository.js';
import {
  SsfProjectionPhaseError,
  SsfProjectionSubjectsChangedError,
  type SsfAuthorizationProjectionInput,
  type SsfAuthorizationProjectionLockedStore,
  type SsfAuthorizationProjectionReconcileResult,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from './authorization-projection-reconciler-contract.js';

export {
  SsfProjectionSubjectsChangedError,
  type SsfAuthorizationProjectionInput,
  type SsfAuthorizationProjectionLockedStore,
  type SsfAuthorizationProjectionReconcileResult,
  type SsfAuthorizationProjectionStore,
  type SsfAuthorizationProjectionTarget,
} from './authorization-projection-reconciler-contract.js';

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

const confirmProjectionReadBack = async (
  target: SsfAuthorizationProjectionTarget,
  store: SsfAuthorizationProjectionLockedStore,
  staged: SsfAuthorizationProjectionState,
  retrySubjectChanges: boolean
): Promise<boolean> => {
  let readBack: SsfAuthorizationProjection;
  try {
    readBack = await target.readBack(staged.instanceId);
  } catch {
    throw new SsfProjectionPhaseError('target_readback_failed');
  }

  if (
    retrySubjectChanges &&
    !areSsfAuthorizationProjectionsEqual(staged.desiredProjection, readBack)
  ) {
    const effectiveDesired = await target.resolveProjection(staged.desiredProjection);
    // Retry only a deletion-only mismatch. Incorrect surviving claims remain an integrity failure.
    if (
      !areSsfAuthorizationProjectionsEqual(staged.desiredProjection, effectiveDesired) &&
      areSsfAuthorizationProjectionsEqual(effectiveDesired, readBack)
    ) {
      throw new SsfProjectionSubjectsChangedError();
    }
  }

  return store.confirmReadBack({
    desired: staged.desiredProjection,
    readBack,
    generation: staged.generation,
  });
};

const reconcileClaimedProjection = async (
  dependencies: SsfAuthorizationProjectionReconcilerDependencies,
  store: SsfAuthorizationProjectionLockedStore,
  staged: SsfAuthorizationProjectionState,
  retrySubjectChanges: boolean
): Promise<SsfAuthorizationProjectionReconcileResult> => {
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
      if (retrySubjectChanges && error instanceof SsfProjectionSubjectsChangedError) throw error;
      throw new SsfProjectionPhaseError(
        isTargetIntegrityFailure(error) ? 'target_integrity_failed' : 'target_write_failed'
      );
    }
    const confirmed = await confirmProjectionReadBack(
      dependencies.target,
      store,
      staged,
      retrySubjectChanges
    );
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
    if (retrySubjectChanges && error instanceof SsfProjectionSubjectsChangedError) throw error;
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
  desired: SsfAuthorizationProjection,
  retrySubjectChanges: boolean
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
    ? reconcileClaimedProjection(dependencies, store, staged, retrySubjectChanges)
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
      // Bound retries when external deletions race with listing, writes or read-back.
      for (let attempt = 0; ; attempt++) {
        const desired = 'readDesired' in input ? await input.readDesired() : directDesired!;
        const normalizedDesired = normalizeSsfAuthorizationProjection(desired);
        if (normalizedDesired.instanceId !== instanceId) {
          throw new Error('ssf_authorization_projection_tenant_mismatch');
        }
        const effectiveDesired = normalizeSsfAuthorizationProjection(
          await dependencies.target.resolveProjection(normalizedDesired)
        );
        if (effectiveDesired.instanceId !== instanceId) {
          throw new Error('ssf_authorization_projection_tenant_mismatch');
        }
        try {
          return await reconcileLockedProjection(
            dependencies,
            store,
            effectiveDesired,
            attempt < 2
          );
        } catch (error) {
          if (!(error instanceof SsfProjectionSubjectsChangedError)) throw error;
        }
      }
    });
  };
