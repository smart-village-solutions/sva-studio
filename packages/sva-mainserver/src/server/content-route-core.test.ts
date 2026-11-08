import { afterEach, describe, expect, it } from 'vitest';

import { errorJson } from './content-route-core.js';
import { readActingPrincipalType } from './content-route-context.js';

const request = (headers?: HeadersInit) => new Request('https://studio.test/api', { headers });

describe('versioned Mainserver acting-principal contract', () => {
  afterEach(() => {
    delete process.env.SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE;
  });

  it('accepts explicit v2 principals and rejects unsupported versions', async () => {
    expect(
      readActingPrincipalType(
        request({
          'X-SVA-Mainserver-Contract-Version': '2',
          'X-SVA-Acting-Principal-Type': 'user',
        })
      )
    ).toBe('user');

    const unsupported = readActingPrincipalType(
      request({ 'X-SVA-Mainserver-Contract-Version': '99' })
    );
    expect(unsupported).toBeInstanceOf(Response);
    expect((unsupported as Response).status).toBe(400);
    await expect((unsupported as Response).json()).resolves.toMatchObject({
      error: 'unsupported_mainserver_contract_version',
    });
  });

  it('keeps headerless legacy clients deterministic until the required cutover', async () => {
    expect(readActingPrincipalType(request())).toBeUndefined();

    process.env.SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE = 'required';
    const required = readActingPrincipalType(request());
    expect(required).toBeInstanceOf(Response);
    expect((required as Response).status).toBe(400);
    await expect((required as Response).json()).resolves.toMatchObject({
      error: 'acting_principal_type_required',
    });
  });

  it('requires an explicit principal for every v2 request', async () => {
    const required = readActingPrincipalType(request({ 'X-SVA-Mainserver-Contract-Version': '2' }));
    expect(required).toBeInstanceOf(Response);
    await expect((required as Response).json()).resolves.toMatchObject({
      error: 'acting_principal_type_required',
    });
  });
});

describe('local Mainserver validation outcomes', () => {
  it.each([
    [400, 'invalid_request'],
    [403, 'csrf_validation_failed'],
    [409, 'stale_mainserver_context'],
  ])('marks host rejection %s/%s as not applied', (status, code) => {
    expect(errorJson(status, code, 'rejected').headers.get('X-SVA-Mutation-Outcome')).toBe(
      'not_applied'
    );
  });

  it.each([
    [403, 'forbidden'],
    [401, 'unauthorized'],
    [502, 'graphql_error'],
    [500, 'internal_error'],
    [502, 'invalid_request'],
    [400, 'csrf_validation_failed'],
  ])('does not infer provider outcome from %s/%s', (status, code) => {
    expect(errorJson(status, code, 'failed').headers.has('X-SVA-Mutation-Outcome')).toBe(false);
  });
});
