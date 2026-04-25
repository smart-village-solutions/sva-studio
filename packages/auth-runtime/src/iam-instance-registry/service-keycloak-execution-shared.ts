import {
  buildProvisioningInput,
  completeRun as completeTargetRun,
  createQueuedRun as createTargetQueuedRun,
  readQueuedTemporaryPassword as readTargetQueuedTemporaryPassword,
  syncProvisionedClientSecretToRegistry as syncTargetProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry as syncTargetRotatedClientSecretToRegistry,
} from '@sva/instance-registry/service-keycloak-execution-shared';
import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export { buildProvisioningInput };

const authSecretDeps = () => withAuthInstanceRegistryDeps({}) as InstanceRegistryServiceDeps;

export const readQueuedTemporaryPassword = (
  runId: string,
  details: Readonly<Record<string, unknown>> | undefined
): string | undefined => readTargetQueuedTemporaryPassword(authSecretDeps(), runId, details);

export const createQueuedRun = (
  deps: InstanceRegistryServiceDeps,
  ...args: Tail<Parameters<typeof createTargetQueuedRun>>
) => createTargetQueuedRun(withAuthInstanceRegistryDeps(deps), ...args);

export const syncRotatedClientSecretToRegistry = (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof syncTargetRotatedClientSecretToRegistry>[1]
) => syncTargetRotatedClientSecretToRegistry(withAuthInstanceRegistryDeps(deps), input);

export const syncProvisionedClientSecretToRegistry = (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof syncTargetProvisionedClientSecretToRegistry>[1]
) => syncTargetProvisionedClientSecretToRegistry(withAuthInstanceRegistryDeps(deps), input);

export const completeRun = (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof completeTargetRun>[1]
) => completeTargetRun(withAuthInstanceRegistryDeps(deps), input);

type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer TRest] ? TRest : never;
