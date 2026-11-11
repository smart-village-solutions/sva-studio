import { expect, it } from 'vitest';
import { ssfModuleIamContract } from './ssf-module-iam-contract.js';
it('grants all tenant permissions to bootstrap and system admins without root permissions', () => {
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
    expect(role.permissionIds).toEqual(ssfModuleIamContract.permissionIds);
  expect(ssfModuleIamContract.rootSystemRoles).toEqual([]);
});
