import { describe, expect, it } from 'vitest';
import * as runtime from '@sva/server-runtime';
import { getEncryptionConfig, protectField, revealField } from './encryption.js';

describe('IAM field encryption compatibility exports', () => {
  it('shares the runtime implementation and configuration cache', () => {
    expect(getEncryptionConfig).toBe(runtime.getEncryptionConfig);
    expect(protectField).toBe(runtime.protectField);
    expect(revealField).toBe(runtime.revealField);
  });
});
