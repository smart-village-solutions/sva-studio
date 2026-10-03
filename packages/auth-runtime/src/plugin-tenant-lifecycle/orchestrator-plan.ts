import type {
  PluginTenantLifecycleOrchestratorDependencies,
  StartPluginTenantLifecycleInput,
} from './orchestrator.js';

export const pluginTenantLifecycleHostErrorCodes = {
  notDeclared: 'plugin_tenant_lifecycle_not_declared',
  inactive: 'plugin_tenant_lifecycle_inactive',
  invalidTransition: 'plugin_tenant_lifecycle_invalid_transition',
  operationNotDeclared: 'plugin_tenant_lifecycle_operation_not_declared',
  handlerMissing: 'plugin_tenant_lifecycle_handler_missing',
  cancellationMismatch: 'plugin_tenant_lifecycle_cancellation_mismatch',
  claimConflict: 'plugin_tenant_lifecycle_claim_conflict',
  claimFailed: 'plugin_tenant_lifecycle_claim_failed',
  jobCreationFailed: 'plugin_tenant_lifecycle_job_creation_failed',
  enqueueFailed: 'plugin_tenant_lifecycle_enqueue_failed',
} as const;

export const lifecycleError = (code: string, pluginId: string, operation?: string): Error =>
  new Error([code, pluginId, operation].filter(Boolean).join(':'));

export const resolveLifecycleOperation = async (
  dependencies: PluginTenantLifecycleOrchestratorDependencies,
  input: StartPluginTenantLifecycleInput
) => {
  const lifecycle = dependencies.lifecycleRegistry.get(input.pluginId);
  if (!lifecycle) {
    throw lifecycleError(pluginTenantLifecycleHostErrorCodes.notDeclared, input.pluginId);
  }
  const activation = await dependencies.resolveActivation(input.instanceId, input.pluginId);
  if (!activation?.effectiveActive) {
    throw lifecycleError(pluginTenantLifecycleHostErrorCodes.inactive, input.pluginId);
  }
  const operationDefinition = lifecycle.operations.find(
    ({ operation }) => operation === input.operation
  );
  if (!operationDefinition) {
    throw lifecycleError(
      pluginTenantLifecycleHostErrorCodes.operationNotDeclared,
      input.pluginId,
      input.operation
    );
  }
  const currentLifecycle = await dependencies.resolveLifecycle(input.instanceId, input.pluginId);
  const resumesPersistedRetry =
    currentLifecycle?.retryKind === 'retryable' &&
    currentLifecycle.desiredOperation === input.operation;
  const invalidTransition =
    !resumesPersistedRetry &&
    ((input.operation === 'suspend' && currentLifecycle?.accessState === 'suspended') ||
      (input.operation === 'reactivate' && currentLifecycle?.accessState !== 'suspended'));
  if (invalidTransition) {
    throw lifecycleError(
      pluginTenantLifecycleHostErrorCodes.invalidTransition,
      input.pluginId,
      input.operation
    );
  }
  const registration = dependencies.resolveJobRegistration(operationDefinition.jobTypeId);
  if (!registration) {
    throw lifecycleError(
      pluginTenantLifecycleHostErrorCodes.handlerMissing,
      input.pluginId,
      input.operation
    );
  }
  if (
    (operationDefinition.supportsCancellation === true) !==
    (registration.supportsCancellation === true)
  ) {
    throw lifecycleError(
      pluginTenantLifecycleHostErrorCodes.cancellationMismatch,
      input.pluginId,
      input.operation
    );
  }
  return { lifecycle, operationDefinition, registration };
};
