import { describe, expect, it } from 'vitest';

import {
  createOrganizationFormValues,
  getOrganizationParentOptions,
  toOrganizationMutationPayload,
} from './-organization-shared';

describe('organization shared helpers', () => {
  it('normalizes organization form values for mutations', () => {
    expect(
      toOrganizationMutationPayload({
        organizationKey: ' landkreis-alpha ',
        displayName: ' Landkreis Alpha ',
        organizationType: 'county',
        parentOrganizationId: '',
        contentAuthorPolicy: 'org_or_personal',
      })
    ).toEqual({
      organizationKey: 'landkreis-alpha',
      displayName: 'Landkreis Alpha',
      organizationType: 'county',
      parentOrganizationId: undefined,
      contentAuthorPolicy: 'org_or_personal',
    });
  });

  it('filters the current organization from parent options', () => {
    expect(
      getOrganizationParentOptions(
        [
          { id: 'org-1', displayName: 'Alpha' },
          { id: 'org-2', displayName: 'Beta' },
        ],
        'org-1'
      )
    ).toEqual([{ id: 'org-2', displayName: 'Beta' }]);
  });

  it('provides the default organization form state', () => {
    expect(createOrganizationFormValues()).toEqual({
      organizationKey: '',
      displayName: '',
      organizationType: 'other',
      parentOrganizationId: '',
      contentAuthorPolicy: 'org_only',
    });
  });
});
