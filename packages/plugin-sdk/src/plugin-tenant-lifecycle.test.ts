import { describe, expect, it } from 'vitest';

import {
  createBuildTimeRegistry,
  createPluginRegistry,
  createPluginTenantReadinessReadModel,
  createPluginTenantReadinessSnapshot,
  evaluatePluginTenantAccess,
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
  it('keeps tenant access closed until lifecycle evidence is valid and non-blocking', () => {
    expect(evaluatePluginTenantAccess(null)).toEqual({ allowed: false, reason: 'inactive' });

    const base = {
      pluginId: 'speech',
      activationPolicy: 'required' as const,
      effectiveActive: true as const,
      accessState: 'active' as const,
      evidenceState: 'valid' as const,
      desiredGeneration: 1,
      completedGeneration: 1,
      checks: [],
      updatedAt: '2026-08-30T00:00:00.000Z',
    };

    expect(evaluatePluginTenantAccess({ ...base, status: 'ready' })).toEqual({
      allowed: true,
      reason: 'ready',
    });
    expect(evaluatePluginTenantAccess({ ...base, status: 'degraded' })).toEqual({
      allowed: true,
      reason: 'degraded',
    });
    expect(
      evaluatePluginTenantAccess({ ...base, status: 'ready', evidenceState: 'invalid' })
    ).toEqual({ allowed: false, reason: 'evidence_invalid' });
    expect(
      evaluatePluginTenantAccess({ ...base, status: 'ready', accessState: 'suspended' })
    ).toEqual({ allowed: false, reason: 'suspended' });
    expect(evaluatePluginTenantAccess({ ...base, status: 'blocked' })).toEqual({
      allowed: false,
      reason: 'blocked',
    });
  });
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

  it('derives readiness fail-closed from declared required and optional checks', () => {
    const snapshot = createPluginTenantReadinessSnapshot({
      definition: {
        ...tenantLifecycle,
        readinessChecks: [
          ...tenantLifecycle.readinessChecks,
          {
            checkId: 'speech.optionalTelemetry',
            titleKey: 'speech.readiness.optionalTelemetry',
            required: false,
          },
        ],
      },
      pluginId: 'speech',
      instanceId: 'tenant-a',
      generation: 3,
      result: {
        revision: 'schema:3',
        checks: [
          { checkId: 'speech.databaseSchema', status: 'ready' },
          { checkId: 'speech.optionalTelemetry', status: 'blocked' },
        ],
      },
      updatedAt: '2026-08-30T12:00:00.000Z',
    });

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.generation).toBe(3);
  });

  it('rejects incomplete and foreign readiness results', () => {
    expect(() =>
      createPluginTenantReadinessSnapshot({
        definition: tenantLifecycle,
        pluginId: 'speech',
        instanceId: 'tenant-a',
        generation: 3,
        result: { revision: 'schema:3', checks: [] },
        updatedAt: '2026-08-30T12:00:00.000Z',
      })
    ).toThrow('missing_plugin_tenant_readiness_check_result:speech.databaseSchema');

    expect(() =>
      createPluginTenantReadinessSnapshot({
        definition: tenantLifecycle,
        pluginId: 'speech',
        instanceId: 'tenant-a',
        generation: 3,
        result: {
          revision: 'schema:3',
          checks: [{ checkId: 'waste.databaseSchema', status: 'ready' }],
        },
        updatedAt: '2026-08-30T12:00:00.000Z',
      })
    ).toThrow(
      'plugin_tenant_readiness_check_result_namespace_mismatch:speech:waste:waste.databaseSchema'
    );
  });

  it('creates pending readiness for an active plugin without lifecycle evidence', () => {
    expect(
      createPluginTenantReadinessReadModel({
        definition: { pluginId: 'speech', ...tenantLifecycle },
        activation: {
          activationPolicy: 'automatic',
          effectiveActive: true,
          updatedAt: '2026-08-30T12:00:00.000Z',
        },
      })
    ).toEqual({
      pluginId: 'speech',
      activationPolicy: 'automatic',
      effectiveActive: true,
      accessState: 'active',
      status: 'pending',
      evidenceState: 'missing',
      desiredGeneration: 0,
      completedGeneration: 0,
      checks: [
        {
          ...tenantLifecycle.readinessChecks[0],
          status: 'pending',
        },
      ],
      updatedAt: '2026-08-30T12:00:00.000Z',
    });
  });

  it('merges declared checks with persisted evidence and stable repair metadata', () => {
    const model = createPluginTenantReadinessReadModel({
      definition: { pluginId: 'speech', ...tenantLifecycle },
      activation: {
        activationPolicy: 'required',
        effectiveActive: true,
        updatedAt: '2026-08-30T12:00:00.000Z',
      },
      evidence: {
        accessState: 'active',
        readinessStatus: 'blocked',
        desiredOperation: 'reconcile',
        desiredGeneration: 4,
        completedGeneration: 3,
        activeJobId: 'job-4',
        readinessRevision: 'schema:3',
        readinessChecks: [
          {
            checkId: 'speech.databaseSchema',
            status: 'blocked',
            messageKey: 'speech.readiness.databaseSchemaBlocked',
          },
        ],
        errorCode: 'speech.databaseUnavailable',
        retryKind: 'retryable',
        updatedAt: '2026-08-30T12:05:00.000Z',
      },
    });

    expect(model).toMatchObject({
      pluginId: 'speech',
      activationPolicy: 'required',
      status: 'blocked',
      evidenceState: 'valid',
      desiredOperation: 'reconcile',
      desiredGeneration: 4,
      completedGeneration: 3,
      activeJobId: 'job-4',
      revision: 'schema:3',
      error: { code: 'speech.databaseUnavailable', retryKind: 'retryable' },
      checks: [
        {
          checkId: 'speech.databaseSchema',
          titleKey: 'speech.readiness.databaseSchema',
          required: true,
          repairOperation: 'reconcile',
          status: 'blocked',
          messageKey: 'speech.readiness.databaseSchemaBlocked',
        },
      ],
    });
  });

  it('omits inactive plugins from the readiness read model', () => {
    expect(
      createPluginTenantReadinessReadModel({
        definition: { pluginId: 'speech', ...tenantLifecycle },
        activation: {
          activationPolicy: 'optional',
          effectiveActive: false,
          updatedAt: '2026-08-30T12:00:00.000Z',
        },
      })
    ).toBeNull();
  });

  it('blocks a persisted ready state when required check evidence is missing', () => {
    expect(
      createPluginTenantReadinessReadModel({
        definition: { pluginId: 'speech', ...tenantLifecycle },
        activation: {
          activationPolicy: 'required',
          effectiveActive: true,
          updatedAt: '2026-08-30T12:00:00.000Z',
        },
        evidence: {
          accessState: 'active',
          readinessStatus: 'ready',
          desiredOperation: 'readiness',
          desiredGeneration: 3,
          completedGeneration: 3,
          readinessRevision: 'schema:3',
          readinessChecks: [],
          updatedAt: '2026-08-30T12:05:00.000Z',
        },
      })
    ).toMatchObject({
      status: 'blocked',
      evidenceState: 'invalid',
      error: { code: 'plugin_tenant_readiness_evidence_invalid' },
      checks: [{ checkId: 'speech.databaseSchema', status: 'pending' }],
    });
  });
});
