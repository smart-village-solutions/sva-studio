import { describe, expect, it } from 'vitest';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildCreateInstancePayloadFingerprint } from './service-instance-create-fingerprint.js';

const baseInput: CreateInstanceProvisioningInput = {
  instanceId: 'demo',
  displayName: 'Demo',
  parentDomain: 'Studio.Example.Org',
  realmMode: 'new',
  authRealm: 'demo',
  authClientId: 'studio-client',
  authClientSecret: ' client-secret ',
  tenantAdminClient: { clientId: 'tenant-admin', secret: ' admin-secret ' },
  featureFlags: { beta: true, alpha: false },
  idempotencyKey: 'idem-1',
  actorId: 'actor-1',
  requestId: 'request-1',
};

describe('create instance payload fingerprint', () => {
  it('normalizes host, secrets, object order and request metadata', () => {
    const equivalent: CreateInstanceProvisioningInput = {
      ...baseInput,
      parentDomain: 'studio.example.org',
      authClientSecret: 'client-secret',
      tenantAdminClient: { clientId: 'tenant-admin', secret: 'admin-secret' },
      featureFlags: { alpha: false, beta: true },
      idempotencyKey: 'another-key',
      actorId: 'actor-2',
      requestId: 'request-2',
    };

    expect(buildCreateInstancePayloadFingerprint(equivalent)).toBe(
      buildCreateInstancePayloadFingerprint(baseInput)
    );
  });

  it.each([
    ['displayName', { displayName: 'Changed' }],
    ['parentDomain', { parentDomain: 'other.example.org' }],
    ['tenantAdminClient', { tenantAdminClient: { clientId: 'other-client' } }],
    ['featureFlags', { featureFlags: { beta: false, alpha: false } }],
  ])('changes when %s changes', (_field, override) => {
    expect(buildCreateInstancePayloadFingerprint({ ...baseInput, ...override })).not.toBe(
      buildCreateInstancePayloadFingerprint(baseInput)
    );
  });

  it('does not persist an offline verifier for submitted client secrets', () => {
    expect(
      buildCreateInstancePayloadFingerprint({
        ...baseInput,
        authClientSecret: 'different-secret',
        tenantAdminClient: { clientId: 'tenant-admin', secret: 'different-admin-secret' },
      })
    ).toBe(buildCreateInstancePayloadFingerprint(baseInput));
  });

  it('binds secret presence without fingerprinting the secret value', () => {
    expect(
      buildCreateInstancePayloadFingerprint({
        ...baseInput,
        authClientSecret: undefined,
      })
    ).not.toBe(buildCreateInstancePayloadFingerprint(baseInput));
    expect(
      buildCreateInstancePayloadFingerprint({
        ...baseInput,
        tenantAdminClient: { clientId: 'tenant-admin' },
      })
    ).not.toBe(buildCreateInstancePayloadFingerprint(baseInput));
  });
});
