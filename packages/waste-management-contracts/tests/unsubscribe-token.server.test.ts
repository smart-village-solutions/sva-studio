import { describe, expect, it } from 'vitest';

import {
  createWasteManagementUnsubscribeToken,
  readWasteManagementUnsubscribeTokenSubscriptionId,
  verifyWasteManagementUnsubscribeToken,
} from '../src/unsubscribe-token.server.js';

const tokenInput = {
  subscriptionId: 'subscription-1',
  unsubscribeTokenHash: 'sha256:unsubscribe-token',
  secret: 'test-signing-secret',
} as const;

const goldenToken = [
  'v1.subscription-1.',
  'ANZrBWOB',
  'tZGPGD4I',
  'hq2HtzgK',
  'ZWp03duL',
  '71Ytlih5',
  'uAo',
].join('');

describe('waste management unsubscribe token', () => {
  it('preserves the existing v1 token format byte-for-byte', () => {
    expect(createWasteManagementUnsubscribeToken(tokenInput)).toBe(goldenToken);
    expect(readWasteManagementUnsubscribeTokenSubscriptionId(goldenToken)).toBe(
      tokenInput.subscriptionId
    );
    expect(
      verifyWasteManagementUnsubscribeToken({
        token: goldenToken,
        ...tokenInput,
      })
    ).toBe(true);
  });

  it.each([
    ['different secret', { secret: 'different-secret' }],
    ['different subscription id', { subscriptionId: 'subscription-2' }],
    ['different stored hash', { unsubscribeTokenHash: 'sha256:different-token' }],
    ['manipulated signature', { token: `${goldenToken}x` }],
    ['short signature', { token: 'v1.subscription-1.short' }],
  ])('rejects a token with %s', (_label, override) => {
    expect(
      verifyWasteManagementUnsubscribeToken({
        token: goldenToken,
        ...tokenInput,
        ...override,
      })
    ).toBe(false);
  });

  it.each([
    '',
    'v2.subscription-1.signature',
    'v1..signature',
    'v1.subscription-1.',
    'v1.subscription-1.signature.extra',
  ])('rejects the malformed token %j', (token) => {
    expect(readWasteManagementUnsubscribeTokenSubscriptionId(token)).toBeNull();
    expect(
      verifyWasteManagementUnsubscribeToken({
        token,
        ...tokenInput,
      })
    ).toBe(false);
  });
});
