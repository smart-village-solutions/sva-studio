import { afterEach, describe, expect, it } from 'vitest';

import {
  clearLegalAcceptanceReturnTo,
  readLegalAcceptanceReturnTo,
  storeLegalAcceptanceReturnTo,
} from './legal-acceptance-navigation';

describe('legal-acceptance-navigation', () => {
  afterEach(() => {
    clearLegalAcceptanceReturnTo();
  });

  it('stores and reads sanitized internal return targets', () => {
    expect(storeLegalAcceptanceReturnTo('/admin/users?tab=permissions')).toBe('/admin/users?tab=permissions');
    expect(readLegalAcceptanceReturnTo()).toBe('/admin/users?tab=permissions');
  });

  it('falls back to the default path for external targets', () => {
    expect(storeLegalAcceptanceReturnTo('https://evil.example')).toBe('/');
    expect(readLegalAcceptanceReturnTo()).toBe('/');
  });
});
