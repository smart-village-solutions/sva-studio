import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { markKnownSession, readHadKnownSession } from './auth-session-state';

const localStorageState = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageState.delete(key);
  }),
};

describe('auth-session-state', () => {
  beforeEach(() => {
    localStorageState.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    localStorageState.clear();
  });

  it('reads a known session marker from localStorage', () => {
    markKnownSession();

    expect(readHadKnownSession()).toBe(true);
  });

  it('returns false when localStorage.getItem throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        ...localStorageMock,
        getItem: vi.fn(() => {
          throw new Error('storage blocked');
        }),
      },
    });

    expect(readHadKnownSession()).toBe(false);
  });
});
