import {
  areSsfAuthorizationProjectionsEqual,
  normalizeSsfAuthorizationProjection,
  type SsfAuthorizationProjection,
} from './authorization-projection.js';
import type { SsfAuthorizationProjectionState } from './authorization-projection-repository.js';
import {
  SsfProjectionPhaseError,
  SsfProjectionSubjectsChangedError,
  type SsfAuthorizationProjectionLockedStore,
  type SsfAuthorizationProjectionTarget,
} from './authorization-projection-reconciler-contract.js';

/** Abort unverified authorization changes without leaving obsolete token claims enabled. */
export const resolveEffectiveProjection = async (
  target: SsfAuthorizationProjectionTarget,
  desired: SsfAuthorizationProjection
): Promise<SsfAuthorizationProjection> => {
  try {
    const effective = normalizeSsfAuthorizationProjection(await target.resolveProjection(desired));
    if (effective.instanceId !== desired.instanceId) {
      throw new Error('ssf_authorization_projection_tenant_mismatch');
    }
    return effective;
  } catch (error) {
    try {
      await target.suspendTokenIssuance(desired.instanceId);
    } catch {
      throw new SsfProjectionPhaseError('token_issuance_suspend_failed');
    }
    throw error;
  }
};

export const confirmProjectionReadBack = async (
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
