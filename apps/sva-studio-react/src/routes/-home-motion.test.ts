import { describe, expect, it, vi } from 'vitest';

import { resolveHomeMotionMode } from './-home-motion';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe('resolveHomeMotionMode', () => {
  it('plays the full anonymous and authenticated scenes once each per session', () => {
    const storage = createStorage();

    expect(resolveHomeMotionMode('anonymous', storage)).toBe('full');
    expect(resolveHomeMotionMode('anonymous', storage)).toBe('compact');
    expect(resolveHomeMotionMode('authenticated', storage)).toBe('full');
    expect(resolveHomeMotionMode('authenticated', storage)).toBe('compact');

    expect([...new Set(storage.setItem.mock.calls.map(([key]) => key))]).toEqual([
      'sva-studio:home-motion:anonymous:v1',
      'sva-studio:home-motion:authenticated:v1',
    ]);
    expect(storage.setItem).toHaveBeenCalledWith('sva-studio:home-motion:anonymous:v1', 'seen');
  });

  it('falls back to compact motion when session storage is unavailable', () => {
    expect(resolveHomeMotionMode('anonymous', undefined)).toBe('compact');

    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      setItem: vi.fn(),
    };
    expect(resolveHomeMotionMode('authenticated', storage)).toBe('compact');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
