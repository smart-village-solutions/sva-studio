import type { PluginServerHandlerRegistryEntry } from '@sva/plugin-sdk';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import type { PluginServerHandlerDispatcherDependencies } from './dispatcher.js';

type PlatformRequirement = Extract<
  PluginServerHandlerRegistryEntry['accessRequirement'],
  { kind: 'platform' }
>;

const satisfiesSet = (
  requirement: PlatformRequirement['roles'],
  available: ReadonlySet<string>
): boolean =>
  requirement.mode === 'allOf'
    ? requirement.values.every((value) => available.has(value))
    : requirement.values.some((value) => available.has(value));

export const authorizePluginPlatformHandler = (input: {
  readonly request: Request;
  readonly requirement: PlatformRequirement;
  readonly roles: readonly string[];
  readonly isPlatformHost: NonNullable<PluginServerHandlerDispatcherDependencies['isPlatformHost']>;
  readonly translate: NonNullable<PluginServerHandlerDispatcherDependencies['translate']>;
}): Response | null =>
  input.isPlatformHost(input.request) && satisfiesSet(input.requirement.roles, new Set(input.roles))
    ? null
    : createApiError(
        403,
        'forbidden',
        input.translate(input.request, 'platformPermissionDenied'),
        getWorkspaceContext().requestId
      );
