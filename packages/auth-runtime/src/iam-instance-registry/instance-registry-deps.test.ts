import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectField: vi.fn(),
  revealField: vi.fn(),
  readKeycloakStateViaProvisioner: vi.fn(),
  loadWasteDataSourceRecord: vi.fn(),
  saveWasteDataSourceRecord: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadWasteDataSourceRecord: mocks.loadWasteDataSourceRecord,
  saveWasteDataSourceRecord: mocks.saveWasteDataSourceRecord,
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: mocks.protectField,
  revealField: mocks.revealField,
}));

vi.mock('./provisioning-auth-state.js', () => ({
  readKeycloakStateViaProvisioner: mocks.readKeycloakStateViaProvisioner,
}));

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

describe('withAuthInstanceRegistryDeps', () => {
  it('injects encryption, provisioner, and waste datasource helpers into auth registry deps', () => {
    const custom = {
      invalidateHost: vi.fn(),
    };

    const enriched = withAuthInstanceRegistryDeps(custom);

    expect(enriched.invalidateHost).toBe(custom.invalidateHost);
    expect(enriched.protectSecret).toBe(mocks.protectField);
    expect(enriched.revealSecret).toBe(mocks.revealField);
    expect(enriched.readKeycloakStateViaProvisioner).toBe(mocks.readKeycloakStateViaProvisioner);
    expect(enriched.loadWasteDataSourceRecord).toBe(mocks.loadWasteDataSourceRecord);
    expect(enriched.saveWasteDataSourceRecord).toBe(mocks.saveWasteDataSourceRecord);
  });
});
