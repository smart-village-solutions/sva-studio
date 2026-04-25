import { describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  revealField: (value: string | null) => value ?? undefined,
}));

import {
  chooseActiveOrganizationId,
  escapeIlikePattern,
  isHierarchyError,
  loadContextOptions,
  loadOrganizationDetail,
  loadOrganizationList,
  mapContextOption,
  mapMembershipRow,
  mapOrganizationListItem,
  readOrganizationTypeFilter,
  readStatusFilter,
  resolveHierarchyFields,
  type OrganizationRow,
} from './organization-query.js';
import type { QueryClient } from './query-client.js';

const organizationRow = {
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
  metadata: { source: 'test' },
} as const satisfies OrganizationRow;

describe('organization query helpers', () => {
  it('maps organization rows into api list items', () => {
    expect(mapOrganizationListItem(organizationRow)).toEqual(
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

  it('loads organization lists with filters and pagination', async () => {
    const queries: { readonly text: string; readonly values?: readonly unknown[] }[] = [];
    const client: QueryClient = {
      query: vi.fn(async (text: string, values?: readonly unknown[]) => {
        queries.push({ text, values });
        if (text.includes('COUNT(*)::int AS total')) {
          return { rowCount: 1, rows: [{ total: 1 }] };
        }
        return { rowCount: 1, rows: [organizationRow] };
      }),
    };

    await expect(
      loadOrganizationList(client, {
        instanceId: 'de-musterhausen',
        page: 2,
        pageSize: 25,
        search: 'Alpha_%',
        organizationType: 'municipality',
        isActive: true,
      })
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: 'org-1', organizationKey: 'alpha' })],
      total: 1,
    });

    expect(queries[0]?.values).toEqual(['de-musterhausen', '%Alpha\\_\\%%', 'municipality', true]);
    expect(queries[1]?.values).toEqual(['de-musterhausen', '%Alpha\\_\\%%', 'municipality', true, 25, 25]);
  });

  it('loads organization details and context options', async () => {
    const client: QueryClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes('FROM iam.organizations organization')) {
          return { rowCount: 1, rows: [organizationRow] };
        }
        if (text.includes('FROM iam.account_organizations membership') && text.includes('JOIN iam.accounts account')) {
          return {
            rowCount: 1,
            rows: [
              {
                account_id: 'acc-1',
                keycloak_subject: 'kc-1',
                display_name_ciphertext: 'Display User',
                first_name_ciphertext: null,
                last_name_ciphertext: null,
                email_ciphertext: 'user@example.com',
                membership_visibility: 'internal',
                is_default_context: true,
                created_at: '2026-03-10T10:00:00.000Z',
              },
            ],
          };
        }
        if (text.includes('parent_organization_id = $2::uuid')) {
          return {
            rowCount: 1,
            rows: [{ id: 'org-child', organization_key: 'child', display_name: 'Child', is_active: true }],
          };
        }
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: 'org-1',
              organization_key: 'alpha',
              display_name: 'Alpha',
              organization_type: 'municipality',
              is_active: true,
              is_default_context: true,
            },
          ],
        };
      }),
    };

    await expect(loadOrganizationDetail(client, { instanceId: 'de-musterhausen', organizationId: 'org-1' })).resolves.toEqual(
      expect.objectContaining({
        id: 'org-1',
        metadata: { source: 'test' },
        memberships: [expect.objectContaining({ accountId: 'acc-1' })],
        children: [expect.objectContaining({ organizationKey: 'child' })],
      })
    );
    await expect(loadContextOptions(client, { instanceId: 'de-musterhausen', accountId: 'acc-1' })).resolves.toEqual([
      expect.objectContaining({ organizationId: 'org-1' }),
    ]);
  });

  it('resolves hierarchy fields and rejects invalid parents', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({
        rowCount: 1,
        rows: [
          {
            ...organizationRow,
            id: 'parent-1',
            hierarchy_path: ['root-1'],
            depth: 1,
          },
        ],
      })),
    };

    await expect(
      resolveHierarchyFields(client, { instanceId: 'de-musterhausen', parentOrganizationId: 'parent-1' })
    ).resolves.toEqual({ ok: true, hierarchyPath: ['root-1', 'parent-1'], depth: 2 });
    await expect(
      resolveHierarchyFields(client, {
        instanceId: 'de-musterhausen',
        organizationId: 'org-1',
        parentOrganizationId: 'org-1',
      })
    ).resolves.toEqual(expect.objectContaining({ ok: false, code: 'conflict' }));
  });
});
