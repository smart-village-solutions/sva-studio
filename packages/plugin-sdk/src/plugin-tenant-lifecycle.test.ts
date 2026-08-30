import { describe, expect, it } from 'vitest';

import {
  createBuildTimeRegistry,
  createPluginRegistry,
  definePluginTenantLifecycle,
  definePluginTenantLifecycleError,
  type PluginDefinition,
  type PluginJobTypeDefinition,
  type PluginTenantLifecycleDefinition,
} from './index.js';

const jobTypes: readonly PluginJobTypeDefinition[] = [
  {
    jobTypeId: 'speech.provisionTenant',
    queue: 'plugin-operations',
    displayName: 'Provision tenant',
  },
  {
    jobTypeId: 'speech.reconcileTenant',
    queue: 'plugin-operations',
    displayName: 'Reconcile tenant',
  },
  {
    jobTypeId: 'speech.checkTenantReadiness',
    queue: 'plugin-operations',
    displayName: 'Check tenant readiness',
  },
];

const tenantLifecycle: PluginTenantLifecycleDefinition = {
  contractVersion: 1,
  operations: [
    { operation: 'provision', jobTypeId: 'speech.provisionTenant' },
    {
      operation: 'reconcile',
      jobTypeId: 'speech.reconcileTenant',
      supportsCancellation: true,
    },
    { operation: 'readiness', jobTypeId: 'speech.checkTenantReadiness' },
  ],
  readinessChecks: [
    {
      checkId: 'speech.databaseSchema',
      titleKey: 'speech.readiness.databaseSchema',
      required: true,
      repairOperation: 'reconcile',
    },
  ],
};

const plugin: PluginDefinition = {
  id: 'speech',
  displayName: 'Smart Speech Flow',
  routes: [],
  jobTypes,
  tenantLifecycle,
};

describe('plugin tenant lifecycle contracts', () => {
  it('normalizes and publishes lifecycle contributions in the build-time registry', () => {
    const registry = createBuildTimeRegistry({ plugins: [plugin] });

    expect(registry.pluginTenantLifecycleRegistry.get('speech')).toEqual({
      pluginId: 'speech',
      ...tenantLifecycle,
    });
    expect(registry.tenantLifecycles).toEqual([{ pluginId: 'speech', ...tenantLifecycle }]);
    expect(registry.pluginRegistry.get('speech')?.tenantLifecycle).toEqual(tenantLifecycle);
  });

  it('rejects lifecycle operations that do not resolve to a declared plugin job type', () => {
    expect(() =>
      definePluginTenantLifecycle(
        'speech',
        {
          contractVersion: 1,
          operations: [{ operation: 'provision', jobTypeId: 'speech.missingJob' }],
          readinessChecks: [],
        },
        jobTypes
      )
    ).toThrow('unknown_plugin_tenant_lifecycle_job_type:speech:provision:speech.missingJob');
  });

  it('rejects duplicate operations and foreign readiness checks', () => {
    expect(() =>
      definePluginTenantLifecycle(
        'speech',
        {
          contractVersion: 1,
          operations: [
            { operation: 'provision', jobTypeId: 'speech.provisionTenant' },
            { operation: 'provision', jobTypeId: 'speech.provisionTenant' },
          ],
          readinessChecks: [],
        },
        jobTypes
      )
    ).toThrow('duplicate_plugin_tenant_lifecycle_operation:speech:provision');

    expect(() =>
      definePluginTenantLifecycle(
        'speech',
        {
          contractVersion: 1,
          operations: [{ operation: 'readiness', jobTypeId: 'speech.checkTenantReadiness' }],
          readinessChecks: [
            {
              checkId: 'waste.databaseSchema',
              titleKey: 'speech.readiness.databaseSchema',
              required: true,
            },
          ],
        },
        jobTypes
      )
    ).toThrow('plugin_tenant_readiness_check_namespace_mismatch:speech:waste:waste.databaseSchema');
  });

  it('requires a readiness operation when checks are declared', () => {
    expect(() =>
      createPluginRegistry([
        {
          ...plugin,
          tenantLifecycle: {
            contractVersion: 1,
            operations: [{ operation: 'reconcile', jobTypeId: 'speech.reconcileTenant' }],
            readinessChecks: [
              {
                checkId: 'speech.databaseSchema',
                titleKey: 'speech.readiness.databaseSchema',
                required: true,
                repairOperation: 'reconcile',
              },
            ],
          },
        },
      ])
    ).toThrow('plugin_tenant_readiness_operation_required:speech');
  });

  it('normalizes namespaced lifecycle errors and validates retry hints', () => {
    expect(
      definePluginTenantLifecycleError('speech', {
        code: 'speech.databaseUnavailable',
        messageKey: 'speech.errors.databaseUnavailable',
        retry: { kind: 'retryable', retryAfterMs: 5_000 },
      })
    ).toEqual({
      code: 'speech.databaseUnavailable',
      messageKey: 'speech.errors.databaseUnavailable',
      retry: { kind: 'retryable', retryAfterMs: 5_000 },
    });

    expect(() =>
      definePluginTenantLifecycleError('speech', {
        code: 'speech.databaseUnavailable',
        messageKey: 'speech.errors.databaseUnavailable',
        retry: { kind: 'retryable', retryAfterMs: -1 },
      })
    ).toThrow('invalid_plugin_tenant_lifecycle_error:speech.databaseUnavailable');

    expect(() =>
      definePluginTenantLifecycleError('speech', {
        code: 'waste.databaseUnavailable',
        messageKey: 'speech.errors.databaseUnavailable',
        retry: { kind: 'terminal' },
      })
    ).toThrow(
      'plugin_tenant_lifecycle_error_namespace_mismatch:speech:waste:waste.databaseUnavailable'
    );
  });
});
