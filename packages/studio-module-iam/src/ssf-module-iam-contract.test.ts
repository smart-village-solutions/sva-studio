import { expect, it } from 'vitest';
import { ssfModuleIamContract } from './ssf-module-iam-contract.js';
it('registers explicit recording permissions without granting them to bootstrap or system admins', () => {
  expect(ssfModuleIamContract.permissionIds).toEqual(
    expect.arrayContaining([
      'ssf.recording.request',
      'ssf.recording.review',
      'ssf.recording.review.sworn',
      'ssf.recording.supervise',
      'ssf.recording.recovery.custodian',
    ])
  );
  for (const role of [
    ...ssfModuleIamContract.tenantBootstrapRoles,
    ...ssfModuleIamContract.systemRoles,
  ])
    expect(role.permissionIds).toEqual([
      'ssf.configuration.tenant.manage',
      'ssf.configuration.tenant.read',
    ]);
});
