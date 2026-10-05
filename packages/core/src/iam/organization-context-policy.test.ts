import { describe, expect, it } from 'vitest';

import {
  hasSystemAdminRole,
  resolveOrganizationContextState,
} from './organization-context-policy.js';

describe('organization context policy', () => {
  describe('hasSystemAdminRole', () => {
    it('detects the canonical system_admin role from mixed role inputs', () => {
      expect(hasSystemAdminRole(['editor', 'system_admin'])).toBe(true);
      expect(hasSystemAdminRole([' editor ', ' viewer '])).toBe(false);
      expect(hasSystemAdminRole(undefined)).toBe(false);
    });
  });

  describe('resolveOrganizationContextState', () => {
    const organizations = [
      { organizationId: 'org-1', isActive: true },
      { organizationId: 'org-2', isActive: false },
      { organizationId: 'org-3', isActive: true },
    ] as const;

    it('keeps an explicitly selected organization for system_admin users', () => {
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
        activeOrganizationId: 'org-1',
        canSwitch: true,
        hasVisibleMemberships: true,
        isSystemAdmin: true,
      });
    });

    it('does not select a default organization for system_admin users', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['system_admin'],
        organizations,
        storedActiveOrganizationId: 'org-2',
      });
      expect(state.activeOrganizationId).toBeUndefined();
      expect(state.canSwitch).toBe(true);
    });

    it('resolves the active organization for non-admin users through the injected chooser', () => {
      const state = resolveOrganizationContextState({
        roleNames: ['editor'],
        organizations,
        storedActiveOrganizationId: 'org-1',
        chooseActiveOrganizationId: ({ storedActiveOrganizationId, activeOrganizations }) =>
          storedActiveOrganizationId === 'org-1'
            ? activeOrganizations[1]?.organizationId
            : undefined,
      });

      expect(state).toEqual({
        activeOrganizations: [
          { organizationId: 'org-1', isActive: true },
          { organizationId: 'org-3', isActive: true },
        ],
        activeOrganizationId: 'org-3',
        canSwitch: true,
        hasVisibleMemberships: true,
        isSystemAdmin: false,
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
        isSystemAdmin: false,
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
