import { afterEach, describe, expect, it } from 'vitest';

import {
  configureInstanceRegistryPluginActivationPolicies,
  configureInstanceRegistryPluginRuntimeSnapshot,
  readInstanceRegistryModuleIamRegistry,
  readInstanceRegistryPluginActivationPolicies,
  readInstanceRegistryPluginTenantLifecycleRegistry,
  resetInstanceRegistryPluginActivationPoliciesForTests,
} from './plugin-activation-policy-snapshot.js';

afterEach(resetInstanceRegistryPluginActivationPoliciesForTests);

describe('instance registry plugin activation policy snapshot', () => {
  it('stores a sorted immutable copy of the host-validated snapshot', () => {
    configureInstanceRegistryPluginActivationPolicies({
      revision: 'catalog-2',
      modules: [
        {
          moduleId: 'news',
          activationPolicy: 'optional',
          manifestVersion: 1,
          policyRevision: 'news-1',
        },
        {
          moduleId: 'events',
          activationPolicy: 'automatic',
          manifestVersion: 1,
          policyRevision: 'events-1',
        },
      ],
    });

    expect(readInstanceRegistryPluginActivationPolicies()).toEqual({
      revision: 'catalog-2',
      modules: [
        {
          moduleId: 'events',
          activationPolicy: 'automatic',
          manifestVersion: 1,
          policyRevision: 'events-1',
        },
        {
          moduleId: 'news',
          activationPolicy: 'optional',
          manifestVersion: 1,
          policyRevision: 'news-1',
        },
      ],
    });
    expect(Object.isFrozen(readInstanceRegistryPluginActivationPolicies())).toBe(true);
    expect(Object.isFrozen(readInstanceRegistryPluginActivationPolicies().modules)).toBe(true);
  });

  it('rejects duplicate module policies', () => {
    expect(() =>
      configureInstanceRegistryPluginActivationPolicies({
        revision: 'catalog-invalid',
        modules: [
          {
            moduleId: 'news',
            activationPolicy: 'optional',
            manifestVersion: 1,
            policyRevision: 'news-1',
          },
          {
            moduleId: 'news',
            activationPolicy: 'required',
            manifestVersion: 1,
            policyRevision: 'news-2',
          },
        ],
      })
    ).toThrow('plugin_activation_policy_duplicate_module:news');
  });

  it('publishes activation policies and IAM contracts as one copied runtime snapshot', () => {
    const permissionIds = ['ssf.read'];
    configureInstanceRegistryPluginRuntimeSnapshot({
      activationPolicies: {
        revision: 'ssf-catalog-1',
        modules: [
          {
            moduleId: 'ssf',
            activationPolicy: 'automatic',
            manifestVersion: 1,
            policyRevision: 'ssf-1',
          },
        ],
      },
      moduleIamContracts: [
        {
          moduleId: 'ssf',
          permissionIds,
          tenantBootstrapRoles: [{ roleName: 'tenant_admin', permissionIds }],
          rootSystemRoles: [{ roleName: 'root_admin', permissionIds }],
          systemRoles: [{ roleName: 'system_admin', permissionIds }],
        },
      ],
      tenantLifecycles: [
        {
          pluginId: 'ssf',
          contractVersion: 1,
          operations: [{ operation: 'provision', jobTypeId: 'ssf.provisionTenant' }],
          readinessChecks: [
            { checkId: 'ssf.database', titleKey: 'ssf.readiness.database', required: true },
          ],
        },
      ],
    });

    permissionIds.push('ssf.update');

    expect(readInstanceRegistryPluginActivationPolicies().revision).toBe('ssf-catalog-1');
    expect(readInstanceRegistryModuleIamRegistry().get('ssf')).toEqual({
      moduleId: 'ssf',
      permissionIds: ['ssf.read'],
      tenantBootstrapRoles: [{ roleName: 'tenant_admin', permissionIds: ['ssf.read'] }],
      rootSystemRoles: [{ roleName: 'root_admin', permissionIds: ['ssf.read'] }],
      systemRoles: [{ roleName: 'system_admin', permissionIds: ['ssf.read'] }],
    });
    expect(Object.isFrozen(readInstanceRegistryModuleIamRegistry().get('ssf'))).toBe(true);
    expect(readInstanceRegistryPluginTenantLifecycleRegistry().get('ssf')).toEqual({
      pluginId: 'ssf',
      contractRevision: 'ssf-1:1',
      contractVersion: 1,
      operations: [{ operation: 'provision', jobTypeId: 'ssf.provisionTenant' }],
      readinessChecks: [
        { checkId: 'ssf.database', titleKey: 'ssf.readiness.database', required: true },
      ],
    });
    expect(Object.isFrozen(readInstanceRegistryPluginTenantLifecycleRegistry().get('ssf'))).toBe(
      true
    );
  });

  it('rejects duplicate module IAM contracts without replacing the current snapshot', () => {
    expect(() =>
      configureInstanceRegistryPluginRuntimeSnapshot({
        activationPolicies: { revision: 'invalid', modules: [] },
        tenantLifecycles: [],
        moduleIamContracts: [
          { moduleId: 'ssf', permissionIds: [], systemRoles: [] },
          { moduleId: 'ssf', permissionIds: [], systemRoles: [] },
        ],
      })
    ).toThrow('plugin_module_iam_duplicate_module:ssf');

    expect(readInstanceRegistryPluginActivationPolicies()).toEqual({
      revision: '',
      modules: [],
    });
    expect(readInstanceRegistryModuleIamRegistry().size).toBe(0);
  });
});
