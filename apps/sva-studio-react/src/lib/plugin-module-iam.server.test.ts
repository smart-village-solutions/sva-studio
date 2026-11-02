import { expect, it } from 'vitest';
import { ssfPlugin } from '@sva/plugin-ssf/descriptor';
import { createPluginModuleIamRegistry } from '@sva/plugin-sdk';
import { createStudioModuleIamContracts } from './plugin-module-iam.js';

it('preserves explicit administrator exclusions in host module contracts', async () => {
  const contracts = createStudioModuleIamContracts(
    [
      {
        moduleId: 'synthetic',
        namespace: 'synthetic',
        ownerPluginId: 'synthetic',
        permissionIds: ['synthetic.manage', 'synthetic.review'],
        systemRoles: [{ roleName: 'system_admin', permissionIds: ['synthetic.manage'] }],
        requiredTenantModuleIds: [],
        systemAdminPermissionExclusions: ['synthetic.review'],
      },
    ],
    []
  );
  expect(contracts[0]?.systemAdminPermissionExclusions).toEqual(['synthetic.review']);
});

it('keeps recording grants explicit through normalized descriptor, host composition and bootstrap resolution', async () => {
  // Exercise the real built resolver without adding its private source tree to Studio types.
  // eslint-disable-next-line @nx/enforce-module-boundaries
  const { resolveAssignedModuleContracts } = await import('../../../../packages/instance-registry/dist/service-shared.js');
  const normalized = [...createPluginModuleIamRegistry([{ id: ssfPlugin.id, displayName: ssfPlugin.displayName, moduleIam: ssfPlugin.moduleIam, permissions: ssfPlugin.permissions, routes: [] }]).values()];
  const host = createStudioModuleIamContracts(normalized, []);
  const deps = {
    moduleIamRegistry: new Map(host.map((contract) => [contract.moduleId, contract])),
  } as unknown as Parameters<typeof resolveAssignedModuleContracts>[0];
  const reconciled = resolveAssignedModuleContracts(deps, ['ssf']);
  expect(reconciled[0]?.systemRoles).toEqual([
    {
      roleName: 'system_admin',
      permissionIds: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
    },
  ]);
  expect(reconciled[0]?.permissions.map((permission: { key: string }) => permission.key)).toEqual(
    expect.arrayContaining([
      'ssf.recording.request',
      'ssf.recording.review',
      'ssf.recording.review.sworn',
      'ssf.recording.supervise',
      'ssf.recording.recovery.custodian',
    ])
  );
});
