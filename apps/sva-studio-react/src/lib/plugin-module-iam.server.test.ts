import { expect, it } from 'vitest';
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

it('grants all tenant recording permissions through descriptor and host composition', async () => {
  const { ssfPlugin } = await import('@sva/plugin-ssf/descriptor');
  const normalized = [...createPluginModuleIamRegistry([{ id: ssfPlugin.id, displayName: ssfPlugin.displayName, moduleIam: ssfPlugin.moduleIam, permissions: ssfPlugin.permissions, routes: [] }]).values()];
  const host = createStudioModuleIamContracts(normalized, []);
  expect(host[0]?.systemRoles).toEqual([
    {
      roleName: 'system_admin',
      permissionIds: [
        'ssf.recording.request', 'ssf.recording.review', 'ssf.recording.review.sworn',
        'ssf.recording.supervise', 'ssf.recording.recovery.custodian',
        'ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage',
      ],
    },
  ]);
  const recordingPermissions = [
    'ssf.recording.request', 'ssf.recording.review', 'ssf.recording.review.sworn',
    'ssf.recording.supervise', 'ssf.recording.recovery.custodian',
  ];
  expect(host[0]?.permissionIds).toEqual([
    ...recordingPermissions, 'ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage',
  ]);
  expect(host[0]?.systemAdminPermissionExclusions).toBeUndefined();
});
