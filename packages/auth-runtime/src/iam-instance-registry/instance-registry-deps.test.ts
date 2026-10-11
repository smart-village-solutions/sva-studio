import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectField: vi.fn(),
  revealField: vi.fn(),
  readKeycloakClientSecretsViaProvisioner: vi.fn(),
  readKeycloakRealmCreateCapabilityViaProvisioner: vi.fn(),
  readKeycloakStateViaProvisioner: vi.fn(),
  readInstanceRegistryPluginOidcClientRequirements: vi.fn(),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: mocks.protectField,
  revealField: mocks.revealField,
}));

vi.mock('./provisioning-auth-state.js', () => ({
  readKeycloakClientSecretsViaProvisioner: mocks.readKeycloakClientSecretsViaProvisioner,
  readKeycloakRealmCreateCapabilityViaProvisioner:
    mocks.readKeycloakRealmCreateCapabilityViaProvisioner,
  readKeycloakStateViaProvisioner: mocks.readKeycloakStateViaProvisioner,
}));

vi.mock('./plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginOidcClientRequirements:
    mocks.readInstanceRegistryPluginOidcClientRequirements,
}));

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

describe('withAuthInstanceRegistryDeps', () => {
  it('injects encryption and provisioner helpers into auth registry deps', () => {
    const custom = {
      invalidateHost: vi.fn(),
    };

    const enriched = withAuthInstanceRegistryDeps(custom);

    expect(enriched.invalidateHost).toBe(custom.invalidateHost);
    expect(enriched.protectSecret).toBe(mocks.protectField);
    expect(enriched.revealSecret).toBe(mocks.revealField);
    expect(enriched.readKeycloakClientSecretsViaProvisioner).toBe(
      mocks.readKeycloakClientSecretsViaProvisioner
    );
    expect(enriched.readKeycloakRealmCreateCapability).toBe(
      mocks.readKeycloakRealmCreateCapabilityViaProvisioner
    );
    expect(enriched.readKeycloakStateViaProvisioner).toBe(mocks.readKeycloakStateViaProvisioner);
    expect(enriched.readPluginOidcClientRequirements).toBe(
      mocks.readInstanceRegistryPluginOidcClientRequirements
    );
  });
});
