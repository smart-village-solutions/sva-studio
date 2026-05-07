import {
  invalidateInstanceRegistryHost as invalidateLeadingInstanceRegistryHost,
  loadInstanceAuthClientSecretCiphertext as loadLeadingInstanceAuthClientSecretCiphertext,
  loadInstanceByHostname as loadLeadingInstanceByHostname,
  loadInstanceById as loadLeadingInstanceById,
  loadTenantAdminClientSecretCiphertext as loadLeadingTenantAdminClientSecretCiphertext,
  resetInstanceRegistryCache as resetLeadingInstanceRegistryCache,
  resetInstanceRegistryServerState as resetLeadingInstanceRegistryServerState,
} from '@sva/data-repositories/server';
import { describe, expect, it } from 'vitest';

import {
  invalidateInstanceRegistryHost,
  loadInstanceAuthClientSecretCiphertext,
  loadInstanceByHostname,
  loadInstanceById,
  loadTenantAdminClientSecretCiphertext,
  resetInstanceRegistryCache,
  resetInstanceRegistryServerState,
} from './server';

describe('instance-registry server boundary', () => {
  it('re-exports the leading server helpers from @sva/data-repositories/server', () => {
    expect(resetInstanceRegistryCache).toBe(resetLeadingInstanceRegistryCache);
    expect(resetInstanceRegistryServerState).toBe(resetLeadingInstanceRegistryServerState);
    expect(invalidateInstanceRegistryHost).toBe(invalidateLeadingInstanceRegistryHost);
    expect(loadInstanceByHostname).toBe(loadLeadingInstanceByHostname);
    expect(loadInstanceById).toBe(loadLeadingInstanceById);
    expect(loadInstanceAuthClientSecretCiphertext).toBe(loadLeadingInstanceAuthClientSecretCiphertext);
    expect(loadTenantAdminClientSecretCiphertext).toBe(loadLeadingTenantAdminClientSecretCiphertext);
  });
});
