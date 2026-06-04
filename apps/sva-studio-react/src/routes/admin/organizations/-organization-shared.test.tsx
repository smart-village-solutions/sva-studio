import { describe, expect, it } from 'vitest';

import {
  createOrganizationFormValues,
  getOrganizationParentOptions,
  suggestOrganizationKey,
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
        mainserverApplicationId: ' org-app-1 ',
        mainserverApplicationSecret: ' org-secret-1 ',
        mainserverApplicationSecretSet: true,
      })
    ).toEqual({
      organizationKey: 'landkreis-alpha',
      displayName: 'Landkreis Alpha',
      organizationType: 'county',
      parentOrganizationId: undefined,
      contentAuthorPolicy: 'org_or_personal',
      mainserverApplicationId: 'org-app-1',
      mainserverApplicationSecret: 'org-secret-1',
    });
  });

  it('filters the current organization from parent options', () => {
    expect(
      getOrganizationParentOptions(
        [
          { id: 'org-1', displayName: 'Alpha', organizationKey: 'alpha' },
          { id: 'org-2', displayName: 'Beta', organizationKey: 'beta' },
        ],
        'org-1'
      )
    ).toEqual([{ id: 'org-2', displayName: 'Beta', organizationKey: 'beta' }]);
  });

  it('provides the default organization form state', () => {
    expect(createOrganizationFormValues()).toEqual({
      organizationKey: '',
      displayName: '',
      organizationType: 'other',
      parentOrganizationId: '',
      contentAuthorPolicy: 'org_only',
      mainserverApplicationId: '',
      mainserverApplicationSecret: '',
      mainserverApplicationSecretSet: false,
    });
  });

  it('suggests a normalized organization key from the display name', () => {
    expect(suggestOrganizationKey('Städtische Werke Köln', [])).toBe('stadtische-werke-koln');
  });

  it('collapses repeated separator runs while generating organization keys', () => {
    expect(suggestOrganizationKey('  Alpha --- Beta / Gamma  ', [])).toBe('alpha-beta-gamma');
  });

  it('adds a running suffix when the generated key already exists', () => {
    expect(
      suggestOrganizationKey('Landkreis Alpha', [
        { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
        { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-2' },
      ])
    ).toBe('landkreis-alpha-3');
  });
});
