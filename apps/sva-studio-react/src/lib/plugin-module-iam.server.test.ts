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

it('preserves recording exclusions through the normalized descriptor and host composition', () => {
  const normalized = [...createPluginModuleIamRegistry([{ id: ssfPlugin.id, displayName: ssfPlugin.displayName, moduleIam: ssfPlugin.moduleIam, permissions: ssfPlugin.permissions, routes: [] }]).values()];
  const host = createStudioModuleIamContracts(normalized, []);
  expect(host[0]?.systemRoles).toEqual([
    {
      roleName: 'system_admin',
      permissionIds: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
    },
  ]);
  const recordingPermissions = [
    'ssf.recording.request', 'ssf.recording.review', 'ssf.recording.review.sworn',
    'ssf.recording.supervise', 'ssf.recording.recovery.custodian',
  ];
  expect(host[0]?.permissionIds).toEqual([
    ...recordingPermissions, 'ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage',
  ]);
  expect(host[0]?.systemAdminPermissionExclusions).toEqual(recordingPermissions);
});
