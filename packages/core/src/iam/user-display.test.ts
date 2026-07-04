import { describe, expect, it } from 'vitest';

import { resolveUserDisplayName, resolveUserInitials } from './user-display.js';

describe('user display helpers', () => {
  describe('resolveUserDisplayName', () => {
    it('prefers displayName, then name, then the technical id', () => {
      expect(
        resolveUserDisplayName({
          id: 'user-1',
          displayName: 'Display Name',
          name: 'Fallback Name',
        })
      ).toBe('Display Name');
      expect(
        resolveUserDisplayName({
          id: 'user-2',
          displayName: '   ',
          name: 'Fallback Name',
        })
      ).toBe('Fallback Name');
      expect(
        resolveUserDisplayName({
          id: 'user-3',
          displayName: '   ',
          name: '   ',
        })
      ).toBe('user-3');
    });
  });

  describe('resolveUserInitials', () => {
    it('derives initials from separated name parts and falls back to the raw value prefix', () => {
      expect(resolveUserInitials('Ada Lovelace')).toBe('AL');
      expect(resolveUserInitials('john_doe')).toBe('JD');
      expect(resolveUserInitials('x')).toBe('X');
      expect(resolveUserInitials('  ')).toBe('');
    });
  });
});
