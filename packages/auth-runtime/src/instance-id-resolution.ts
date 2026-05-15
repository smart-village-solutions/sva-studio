export type {
  InstanceIdResolutionResult,
  ResolveInstanceIdInput,
} from './shared/instance-id-resolution.js';

import {
  resolveInstanceIdWithOptions,
  type InstanceIdResolutionResult,
  type ResolveInstanceIdInput,
} from './shared/instance-id-resolution.js';

export const resolveInstanceId = async (input: ResolveInstanceIdInput): Promise<InstanceIdResolutionResult> =>
  resolveInstanceIdWithOptions(input, {
    warningMessage: 'Instance ID resolution failed',
  });
