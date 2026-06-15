import { describe, expectTypeOf, it } from 'vitest';

import type { InstanceRegistryRepository } from './repository-contract.js';

describe('instance registry repository contract', () => {
  it('models repository operations as readonly function properties', () => {
    expectTypeOf<InstanceRegistryRepository['listInstances']>().toEqualTypeOf<
      (input?: { search?: string; status?: 'active' | 'inactive' | 'provisioning' | 'failed' }) => Promise<unknown>
    >();
    expectTypeOf<InstanceRegistryRepository['getInstanceById']>().toBeFunction();
    expectTypeOf<InstanceRegistryRepository['createProvisioningRun']>().toBeFunction();
    expectTypeOf<InstanceRegistryRepository['appendKeycloakProvisioningStep']>().toBeFunction();
  });
});
