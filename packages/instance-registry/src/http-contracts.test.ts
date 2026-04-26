import { describe, expect, it } from 'vitest';

import {
  createInstanceSchema,
  readDetailInstanceId,
  readKeycloakRunId,
} from './http-contracts.js';

describe('http-contracts', () => {
  it('extracts detail instance ids from nested routes', () => {
    expect(
      readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/instances/demo/activate'))
    ).toBe('demo');
    expect(readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/users'))).toBeUndefined();
  });

  it('rejects invalid authIssuerUrl', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      authIssuerUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });

  it('allows create requests without a tenant admin client contract', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
    });

    expect(result.success).toBe(true);
  });

  it('extracts keycloak run ids from nested run routes', () => {
    const request = new Request(
      'https://studio.example.org/api/v1/iam/instances/de-test/keycloak/runs/run-42'
    );

    expect(readKeycloakRunId(request)).toBe('run-42');
  });

  it('returns undefined when keycloak run segment is missing', () => {
    const request = new Request('https://studio.example.org/api/v1/iam/instances/de-test/keycloak');

    expect(readKeycloakRunId(request)).toBeUndefined();
  });
});
