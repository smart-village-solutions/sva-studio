import { describe, expect, it } from 'vitest';

import { wasteTenantProvisioningContract } from './waste-tenant-provisioning-contract.js';

describe('waste tenant provisioning contract', () => {
  it('keeps lifecycle, job and ownership identifiers stable', () => {
    expect(wasteTenantProvisioningContract.statuses).toEqual([
      'provisioning',
      'ready',
      'failed',
      'disabled',
    ]);
    expect(wasteTenantProvisioningContract.jobTypeId).toBe(
      'waste-management.provision-tenant-database'
    );
    expect(wasteTenantProvisioningContract.interfaceAlias).toBe('waste-management');
    expect(wasteTenantProvisioningContract.isStatus('ready')).toBe(true);
    expect(wasteTenantProvisioningContract.isStatus('unknown')).toBe(false);
  });
});

