import {
  withMainserverOwnershipTargetBindingLock,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';

import type { MainserverMutationActor } from './mutation-principal.js';

type BindingRole = 'source' | 'target';

const bindingLockKey = (target: ResolvedMainserverOwnershipTarget): string =>
  `${target.principal.type}:${target.principal.id}:${target.connection.credentialFingerprint}:${target.dataProviderId}`;

export const executeWithMainserverOwnershipBindingLocks = async <T>(input: {
  readonly actor: MainserverMutationActor;
  readonly bindings: readonly Readonly<{
    role: BindingRole;
    target: ResolvedMainserverOwnershipTarget;
  }>[];
  readonly execute: () => Promise<T>;
}): Promise<T> => {
  const bindings = [...input.bindings].sort((left, right) =>
    bindingLockKey(left.target).localeCompare(bindingLockKey(right.target))
  );
  const lockNext = async (index: number): Promise<T> => {
    const binding = bindings[index];
    if (!binding) return input.execute();
    try {
      return await withMainserverOwnershipTargetBindingLock({
        instanceId: input.actor.instanceId,
        target: binding.target,
        execute: () => lockNext(index + 1),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'content_transfer_target_binding_changed') {
        throw new Error(
          binding.role === 'source'
            ? 'content_transfer_source_binding_changed'
            : 'content_transfer_target_binding_conflict'
        );
      }
      throw error;
    }
  };
  return lockNext(0);
};
