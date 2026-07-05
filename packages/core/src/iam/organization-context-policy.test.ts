import { describe, expect, it } from 'vitest';

import {
  hasSystemAdminRole,
  resolveOrganizationContextState,
  resolveSessionActiveOrganizationId,
} from './organization-context-policy.js';

describe('organization context policy', () => {
  describe('hasSystemAdminRole', () => {
    it('detects the canonical system_admin role from mixed role inputs', () => {
      expect(hasSystemAdminRole(['editor', 'system_admin'])).toBe(true);
      expect(hasSystemAdminRole([' editor ', ' viewer '])).toBe(false);
      expect(hasSystemAdminRole(undefined)).toBe(false);
    });
  });

  describe('resolveSessionActiveOrganizationId', () => {
    it('clears active organization scope for system_admin users and keeps it for other roles', () => {
      expect(
        resolveSessionActiveOrganizationId({
          roleNames: ['system_admin'],
          activeOrganizationId: 'org-1',
        })
      ).toBeUndefined();
      expect(
        resolveSessionActiveOrganizationId({
          roleNames: ['editor'],
          activeOrganizationId: 'org-1',
        })
      ).toBe('org-1');
    });
  });

  describe('resolveOrganizationContextState', () => {
    const organizations = [
      { organizationId: 'org-1', isActive: true },
      { organizationId: 'org-2', isActive: false },
      { organizationId: 'org-3', isActive: true },
    ] as const;

    it('returns a read-only membership view for system_admin users', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['system_admin'],
        organizations,
        storedActiveOrganizationId: 'org-1',
        chooseActiveOrganizationId: () => 'org-3',
      });

      expect(state).toEqual({
        activeOrganizations: [
          { organizationId: 'org-1', isActive: true },
          { organizationId: 'org-3', isActive: true },
        ],
        activeOrganizationId: undefined,
        canSwitch: false,
        hasVisibleMemberships: true,
        isReadOnly: true,
      });
    });

    it('resolves the active organization for non-admin users through the injected chooser', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['editor'],
        organizations,
        storedActiveOrganizationId: 'org-1',
        chooseActiveOrganizationId: ({ storedActiveOrganizationId, activeOrganizations }) =>
          storedActiveOrganizationId === 'org-1' ? activeOrganizations[1]?.organizationId : undefined,
      });

      expect(state).toEqual({
        activeOrganizations: [
          { organizationId: 'org-1', isActive: true },
          { organizationId: 'org-3', isActive: true },
        ],
        activeOrganizationId: 'org-3',
        canSwitch: true,
        hasVisibleMemberships: true,
        isReadOnly: false,
      });
    });

    it('handles missing active organizations without exposing a visible context block', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['editor'],
        organizations: [{ organizationId: 'org-1', isActive: false }],
        storedActiveOrganizationId: 'org-1',
      });

      expect(state).toEqual({
        activeOrganizations: [],
        activeOrganizationId: undefined,
        canSwitch: false,
        hasVisibleMemberships: false,
        isReadOnly: false,
      });
    });

    it('keeps a stored active organization when it still belongs to the active memberships', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['editor'],
        organizations,
        storedActiveOrganizationId: 'org-3',
      });

      expect(state.activeOrganizationId).toBe('org-3');
    });

    it('falls back to the first active organization when no stored context matches', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['editor'],
        organizations,
        storedActiveOrganizationId: 'org-2',
      });

      expect(state.activeOrganizationId).toBe('org-1');
    });
  });
});
