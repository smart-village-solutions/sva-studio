import { describe, expect, it } from 'vitest';

import { validateBackupAgentCapabilities } from './verify-backup-agent-capabilities.ts';

const compatible = {
  protocolVersions: [2], agentRevision: 'image@sha256:abc', databaseTargets: ['studio', 'waste'], wasteInventory: true,
  resultFields: ['bytes', 'database', 'deployImageDigest', 'environment', 'objectKey', 'requestId', 'sha256', 'status', 'steps'],
};

describe('backup agent capabilities', () => {
  it('accepts the current v2 Studio and Waste contract', () => {
    expect(validateBackupAgentCapabilities('staging', compatible, true)).toEqual(compatible);
  });

  it.each([
    { ...compatible, protocolVersions: [1] },
    { ...compatible, databaseTargets: ['studio'] },
    { ...compatible, resultFields: compatible.resultFields.filter((field) => field !== 'database') },
  ])('rejects incompatible producer capabilities', (capabilities) => {
    expect(() => validateBackupAgentCapabilities('prod', capabilities, true)).toThrow(/PROMOTE_BACKUP_AGENT_INCOMPATIBLE/u);
  });
});

