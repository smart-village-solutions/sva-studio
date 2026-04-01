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

  it('falls back to the default path for api targets', () => {
    expect(storeLegalAcceptanceReturnTo('/api/v1/iam/me')).toBe('/');
    expect(readLegalAcceptanceReturnTo()).toBe('/');
  });

  it('ignores storage write and delete failures', () => {
    const originalStorage = window.sessionStorage;
    const throwingStorage = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
      removeItem: () => {
        throw new Error('unavailable');
      },
    };

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: throwingStorage,
    });

    expect(storeLegalAcceptanceReturnTo('/admin/users')).toBe('/admin/users');
    expect(readLegalAcceptanceReturnTo()).toBe('/');
    expect(() => clearLegalAcceptanceReturnTo()).not.toThrow();

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: originalStorage,
    });
  });
});
