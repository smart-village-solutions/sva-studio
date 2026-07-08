import { describe, expect, it } from 'vitest';

import {
  assignOrganizationMembershipSchema,
  createOrganizationSchema,
  updateOrganizationMembershipSchema,
  updateOrganizationContextSchema,
  updateOrganizationSchema,
} from './organization-schemas.js';

describe('organization-schemas', () => {
  it('applies defaults for organization creation', () => {
    expect(
      createOrganizationSchema.parse({
        organizationKey: 'stadtwerke',
        displayName: 'Stadtwerke',
      })
    ).toMatchObject({
      organizationType: 'other',
      contentAuthorPolicy: 'org_only',
    });
  });

  it('requires at least one field on update and accepts explicit parent removal', () => {
    expect(() => updateOrganizationSchema.parse({})).toThrow('at_least_one_field_required');

    expect(
      updateOrganizationSchema.parse({
        parentOrganizationId: null,
      })
    ).toMatchObject({
      parentOrganizationId: null,
    });
  });

  it('accepts trimmed mainserver credential fields on create and update payloads', () => {
    expect(
      createOrganizationSchema.parse({
        organizationKey: 'stadtwerke',
        displayName: 'Stadtwerke',
        mainserverApplicationId: '  org-app-1  ',
        mainserverApplicationSecret: '  org-secret-1  ',
      })
    ).toMatchObject({
      mainserverApplicationId: 'org-app-1',
      mainserverApplicationSecret: 'org-secret-1',
    });

    expect(
      updateOrganizationSchema.parse({
        mainserverApplicationId: '  org-app-2  ',
        mainserverApplicationSecret: '  ',
      })
    ).toMatchObject({
      mainserverApplicationId: 'org-app-2',
      mainserverApplicationSecret: '',
    });
  });

  it('validates membership and context payload ids', () => {
    expect(() =>
      assignOrganizationMembershipSchema.parse({
        accountId: 'not-a-uuid',
      })
    ).toThrow();

    expect(
      updateOrganizationContextSchema.parse({
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    ).toMatchObject({
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('requires at least one membership field on membership update', () => {
    expect(() => updateOrganizationMembershipSchema.parse({})).toThrow('at_least_one_field_required');

    expect(
      updateOrganizationMembershipSchema.parse({
        visibility: 'external',
      })
    ).toMatchObject({
      visibility: 'external',
    });

    expect(
      updateOrganizationMembershipSchema.parse({
        isDefaultContext: true,
      })
    ).toMatchObject({
      isDefaultContext: true,
    });
  });
});
