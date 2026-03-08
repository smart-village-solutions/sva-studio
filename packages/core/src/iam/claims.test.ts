import { describe, expect, it } from 'vitest';
import { extractRoles, resolveInstanceId, resolveUserName } from './claims';

describe('claims helpers', () => {
  describe('resolveUserName', () => {
    it('prefers name claim when available', () => {
      expect(resolveUserName({ name: 'Max Mustermann', preferred_username: 'max' })).toBe('Max Mustermann');
    });

    it('falls back to preferred_username', () => {
      expect(resolveUserName({ preferred_username: 'maria' })).toBe('maria');
    });

    it('falls back to given_name + family_name', () => {
      expect(resolveUserName({ given_name: 'Anna', family_name: 'Schmidt' })).toBe('Anna Schmidt');
    });

    it('returns default label for invalid payload', () => {
      expect(resolveUserName({})).toBe('Unbekannt');
      expect(resolveUserName({ name: '   ' })).toBe('Unbekannt');
    });
  });

  describe('resolveInstanceId', () => {
    it('returns trimmed instanceId', () => {
      expect(resolveInstanceId({ instanceId: '  tenant-1  ' })).toBe('tenant-1');
    });

    it('returns undefined for missing or invalid instanceId', () => {
      expect(resolveInstanceId({})).toBeUndefined();
      expect(resolveInstanceId({ instanceId: '' })).toBeUndefined();
      expect(resolveInstanceId({ instanceId: 42 })).toBeUndefined();
    });
  });

  describe('extractRoles', () => {
    it('collects and deduplicates roles from top-level, realm_access and resource_access', () => {
      const roles = extractRoles(
        {
          roles: ['viewer', 'viewer'],
          realm_access: { roles: ['editor'] },
          resource_access: {
            appA: { roles: ['admin'] },
            appB: { roles: ['viewer', 'operator'] },
          },
        },
        'appA'
      );

      expect(roles.sort()).toEqual(['admin', 'editor', 'viewer'].sort());
    });

    it('reads all resource roles when no clientId is provided', () => {
      const roles = extractRoles({
        resource_access: {
          appA: { roles: ['a'] },
          appB: { roles: ['b'] },
        },
      });

      expect(roles.sort()).toEqual(['a', 'b']);
    });

    it('adds system_admin alias for Admin role', () => {
      const roles = extractRoles({
        realm_access: { roles: ['Admin'] },
      });

      expect(roles.sort()).toEqual(['Admin', 'system_admin'].sort());
    });

    it('does not add elevated alias when Admin appears only in resource_access', () => {
      const roles = extractRoles({
        resource_access: {
          appA: { roles: ['Admin'] },
        },
      });

      expect(roles).toEqual(['Admin']);
    });

    it('does not fall back to other clients when explicit clientId has no role entry', () => {
      const roles = extractRoles(
        {
          resource_access: {
            appA: { roles: ['editor'] },
            appB: { roles: ['admin'] },
          },
        },
        'missing-client'
      );

      expect(roles).toEqual([]);
    });

    it('ignores invalid role structures safely', () => {
      const roles = extractRoles({
        roles: [1, 'ok', null],
        realm_access: { roles: 'no-array' },
        resource_access: {
          appA: { roles: [false, 'r1'] },
          appB: 'invalid',
        },
      });

      expect(roles.sort()).toEqual(['ok', 'r1']);
    });
  });
});
