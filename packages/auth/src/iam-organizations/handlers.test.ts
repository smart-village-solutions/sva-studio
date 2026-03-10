import { describe, expect, it, vi } from 'vitest';

vi.mock('../iam-account-management/encryption', () => ({
  revealField: (value: string | null) => value,
}));

vi.mock('../iam-account-management/user-mapping', () => ({
  resolveUserDisplayName: (input: {
    decryptedDisplayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    keycloakSubject: string;
  }) =>
    input.decryptedDisplayName ??
    [input.firstName, input.lastName].filter(Boolean).join(' ').trim() ??
    input.keycloakSubject,
}));

import {
  chooseActiveOrganizationId,
  escapeIlikePattern,
  isHierarchyError,
  mapContextOption,
  mapMembershipRow,
  mapOrganizationListItem,
  readOrganizationTypeFilter,
  readStatusFilter,
} from './handlers.helpers.ts';

describe('iam-organizations helpers', () => {
  it('maps organization rows into api list items', () => {
    expect(
      mapOrganizationListItem({
        id: 'org-1',
        organization_key: 'alpha',
        display_name: 'Alpha',
        parent_organization_id: null,
        parent_display_name: null,
        organization_type: 'municipality',
        content_author_policy: 'org_only',
        is_active: true,
        depth: 0,
        hierarchy_path: null,
        child_count: 2,
        membership_count: 4,
      })
    ).toEqual(
      expect.objectContaining({
        organizationKey: 'alpha',
        hierarchyPath: [],
        childCount: 2,
      })
    );
  });

  it('maps memberships and context options', () => {
    expect(
      mapMembershipRow({
        account_id: 'acc-1',
        keycloak_subject: 'kc-1',
        display_name_ciphertext: 'Display User',
        first_name_ciphertext: 'First',
        last_name_ciphertext: 'Last',
        email_ciphertext: 'user@example.com',
        membership_visibility: 'internal',
        is_default_context: true,
        created_at: '2026-03-10T10:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        displayName: 'Display User',
        email: 'user@example.com',
        isDefaultContext: true,
      })
    );

    expect(
      mapContextOption({
        organization_id: 'org-1',
        organization_key: 'alpha',
        display_name: 'Alpha',
        organization_type: 'municipality',
        is_active: true,
        is_default_context: false,
      })
    ).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        organizationKey: 'alpha',
      })
    );
  });

  it('reads filters and escapes ilike patterns', () => {
    expect(readStatusFilter(new Request('http://localhost/api?status=inactive'))).toBe(false);
    expect(readOrganizationTypeFilter(new Request('http://localhost/api?organizationType=agency'))).toBe('agency');
    expect(readOrganizationTypeFilter(new Request('http://localhost/api?organizationType=invalid'))).toBe('invalid');
    expect(escapeIlikePattern('100%_ok\\test')).toBe('100\\%\\_ok\\\\test');
  });

  it('detects hierarchy errors and chooses the active organization', () => {
    expect(
      isHierarchyError({
        ok: false,
        status: 409,
        code: 'conflict',
        message: 'Conflict',
      })
    ).toBe(true);
    expect(isHierarchyError({ ok: true })).toBe(false);

    expect(
      chooseActiveOrganizationId({
        storedActiveOrganizationId: 'org-2',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'agency',
            isActive: false,
            isDefaultContext: false,
          },
        ],
      })
    ).toBe('org-1');
  });
});
