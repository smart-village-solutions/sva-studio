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

  it.each([
    ['Unicode NFKD input', '  ÄÖÜ Straße № 12  ', 'aou-stra-e-no-12'],
    ['separator-only input', ' --- / ___ ', ''],
    ['edge and repeated separators', '---Alpha___Beta///', 'alpha-beta'],
  ])('preserves the organization key contract for %s', (_caseName, displayName, expectedKey) => {
    expect(suggestOrganizationKey(displayName, [])).toBe(expectedKey);
  });

  it('collapses repeated separator runs while generating organization keys', () => {
    expect(suggestOrganizationKey('  Alpha --- Beta / Gamma  ', [])).toBe('alpha-beta-gamma');
  });

  it('normalizes a very long separator suffix without changing the suggested key', () => {
    expect(suggestOrganizationKey(`Alpha${'-'.repeat(100_000)}`, [])).toBe('alpha');
  });

  it('adds a running suffix when the generated key already exists', () => {
    expect(
      suggestOrganizationKey('Landkreis Alpha', [
        { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
        { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-2' },
      ])
    ).toBe('landkreis-alpha-3');
  });

  it('compares existing keys case-insensitively after trimming', () => {
    expect(
      suggestOrganizationKey('Landkreis Alpha', [
        { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: ' LANDKREIS-ALPHA ' },
        { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'Landkreis-Alpha-2' },
      ])
    ).toBe('landkreis-alpha-3');
  });

  it('excludes the edited organization before resolving key collisions', () => {
    expect(
      suggestOrganizationKey(
        'Landkreis Alpha',
        [
          { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
          { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-2' },
        ],
        'org-1'
      )
    ).toBe('landkreis-alpha');
  });

  it('selects the first available suffix in ascending order', () => {
    expect(
      suggestOrganizationKey('Landkreis Alpha', [
        { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
        { id: 'org-3', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-3' },
      ])
    ).toBe('landkreis-alpha-2');
  });
});
