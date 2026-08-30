import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  normalizeIamTab,
  normalizeOrganizationDetailTab,
  normalizeRoleDetailTab,
} from './route-search.js';

const iamTabs = ['rights', 'governance', 'dsr', 'deletion-rules'] as const;
const roleTabs = ['general', 'permissions', 'assignments', 'sync'] as const;
const organizationTabs = ['organization', 'memberships'] as const;

describe('route search normalization properties', () => {
  it('preserves every declared IAM, role and organization tab', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...iamTabs),
        fc.constantFrom(...roleTabs),
        fc.constantFrom(...organizationTabs),
        (iamTab, roleTab, organizationTab) => {
          expect(normalizeIamTab(iamTab)).toBe(iamTab);
          expect(normalizeRoleDetailTab(roleTab)).toBe(roleTab);
          expect(normalizeOrganizationDetailTab(organizationTab)).toBe(organizationTab);
        }
      )
    );
  });

  it('falls back deterministically for every undeclared value', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        fc.pre(!iamTabs.includes(value as (typeof iamTabs)[number]));
        fc.pre(!roleTabs.includes(value as (typeof roleTabs)[number]));
        fc.pre(!organizationTabs.includes(value as (typeof organizationTabs)[number]));

        expect(normalizeIamTab(value)).toBe('rights');
        expect(normalizeRoleDetailTab(value)).toBe('general');
        expect(normalizeOrganizationDetailTab(value)).toBe('organization');
      })
    );
  });
});
