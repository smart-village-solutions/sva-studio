import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildPayloadFingerprint } from './payload-fingerprint.js';

describe('payload fingerprint', () => {
  it('sorts object keys by code point independent of the runtime locale', () => {
    const expectedPayload = JSON.stringify({ A: true, z: true, 'ä': true });
    const expectedFingerprint = createHash('sha256').update(expectedPayload).digest('hex');

    expect(buildPayloadFingerprint({ 'ä': true, z: true, A: true })).toBe(expectedFingerprint);
  });
});
