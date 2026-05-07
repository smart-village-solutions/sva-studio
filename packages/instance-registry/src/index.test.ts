import { describe, expect, it } from 'vitest';

import { instanceRegistryPackageRoles, instanceRegistryVersion } from './index.js';

describe('@sva/instance-registry package scaffold', () => {
  it('declares the target package role', () => {
    expect(instanceRegistryVersion).toBe('0.0.1');
    expect(instanceRegistryPackageRoles).toContain('provisioning');
  });

  it('keeps internal service helpers out of the root public API', async () => {
    const publicApi = await import('./index.js');

    expect(publicApi).not.toHaveProperty('appendRunStep');
    expect(publicApi).not.toHaveProperty('buildFinalRunSteps');
    expect(publicApi).not.toHaveProperty('failClaimedRun');
    expect(publicApi).not.toHaveProperty('failRun');
    expect(publicApi).not.toHaveProperty('createProvisioningArtifacts');
    expect(publicApi).not.toHaveProperty('provisionInstanceAuth');
    expect(publicApi).not.toHaveProperty('buildProvisioningInput');
    expect(publicApi).not.toHaveProperty('completeRun');
    expect(publicApi).not.toHaveProperty('createQueuedRun');
    expect(publicApi).not.toHaveProperty('readQueuedTemporaryPassword');
    expect(publicApi).not.toHaveProperty('syncProvisionedClientSecretToRegistry');
    expect(publicApi).not.toHaveProperty('syncRotatedClientSecretToRegistry');
    expect(publicApi).not.toHaveProperty('decryptAuthClientSecret');
    expect(publicApi).not.toHaveProperty('decryptTenantAdminClientSecret');
    expect(publicApi).not.toHaveProperty('loadInstanceWithSecret');
    expect(publicApi).not.toHaveProperty('loadRepositoryAuthClientSecret');
    expect(publicApi).not.toHaveProperty('loadRepositoryTenantAdminClientSecret');
    expect(publicApi).not.toHaveProperty('createAuditDetails');
    expect(publicApi).not.toHaveProperty('createStatusArtifacts');
    expect(publicApi).not.toHaveProperty('getAuditEventType');
    expect(publicApi).not.toHaveProperty('getStatusOperation');
    expect(publicApi).not.toHaveProperty('toListItem');
    expect(publicApi).not.toHaveProperty('buildInstanceDetail');
  });
});
