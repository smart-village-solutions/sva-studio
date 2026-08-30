import { assertPluginContributionAllowedKeys } from '../guardrails.js';
import { normalizePluginIdentifier, normalizePluginNamespace } from '../plugin-identifiers.js';
import { assertOwnedNamespacedIdentifier } from './identifiers.js';
import type { PluginTenantLifecycleError } from './types.js';

const errorAllowedKeys = new Set(['code', 'messageKey', 'retry', 'details'] as const);
const retryAllowedKeys = new Set(['kind', 'retryAfterMs'] as const);

export const definePluginTenantLifecycleError = (
  namespace: string,
  error: PluginTenantLifecycleError
): PluginTenantLifecycleError => {
  const pluginNamespace = normalizePluginNamespace(namespace);
  assertPluginContributionAllowedKeys(
    error,
    errorAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(error.code)
  );
  assertPluginContributionAllowedKeys(
    error.retry,
    retryAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(error.code)
  );
  const code = assertOwnedNamespacedIdentifier(
    pluginNamespace,
    error.code,
    'invalid_plugin_tenant_lifecycle_error',
    'plugin_tenant_lifecycle_error_namespace_mismatch'
  );
  const messageKey = normalizePluginIdentifier(error.messageKey);
  if (
    messageKey.length === 0 ||
    (error.retry.kind !== 'terminal' && error.retry.kind !== 'retryable') ||
    (error.retry.kind === 'terminal' && 'retryAfterMs' in error.retry) ||
    (error.retry.kind === 'retryable' &&
      error.retry.retryAfterMs !== undefined &&
      (!Number.isSafeInteger(error.retry.retryAfterMs) || error.retry.retryAfterMs < 0))
  ) {
    throw new Error(`invalid_plugin_tenant_lifecycle_error:${code}`);
  }
  return {
    code,
    messageKey,
    retry:
      error.retry.kind === 'terminal'
        ? { kind: 'terminal' }
        : {
            kind: 'retryable',
            ...(error.retry.retryAfterMs === undefined
              ? {}
              : { retryAfterMs: error.retry.retryAfterMs }),
          },
    ...(error.details ? { details: error.details } : {}),
  };
};
