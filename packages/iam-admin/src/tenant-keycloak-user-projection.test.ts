import { describe, expect, it } from 'vitest';

import {
  mapUnmappedKeycloakUser,
  mergeMappedUserWithKeycloak,
} from './tenant-keycloak-user-projection.js';

describe('tenant-keycloak-user-projection', () => {
  it('maps unmapped Keycloak users and prefers explicit display names', () => {
    expect(
      mapUnmappedKeycloakUser(
        {
          externalId: 'kc-1',
          username: 'm.mustermann',
          email: 'm.mustermann@example.org',
          firstName: 'Max',
          lastName: 'Mustermann',
          enabled: true,
          attributes: { displayName: ['Redaktion'], instanceId: ['de-musterhausen'] },
        },
        [],
        'de-musterhausen'
      )
    ).toEqual({
      id: 'keycloak:kc-1',
      keycloakSubject: 'kc-1',
      displayName: 'Redaktion',
      email: 'm.mustermann@example.org',
      status: 'active',
      mappingStatus: 'unmapped',
      editability: 'blocked',
      diagnostics: [{ code: 'mapping_missing', objectId: 'kc-1', objectType: 'user' }],
      roles: [],
    });
  });

  it('requires manual review when instance attributes are missing or wrong', () => {
    expect(
      mapUnmappedKeycloakUser({ externalId: 'kc-1', attributes: {} }, null, 'de-musterhausen')
    ).toEqual(
      expect.objectContaining({
        mappingStatus: 'manual_review',
        diagnostics: [
          { code: 'missing_instance_attribute', objectId: 'kc-1', objectType: 'user' },
          { code: 'keycloak_projection_degraded', objectId: 'kc-1', objectType: 'user' },
        ],
      })
    );

    expect(
      mapUnmappedKeycloakUser(
        { externalId: 'kc-2', attributes: { instanceId: ['de-altstadt'] } },
        [],
        'de-musterhausen'
      )
    ).toEqual(
      expect.objectContaining({
        mappingStatus: 'manual_review',
        diagnostics: [{ code: 'mapping_incomplete', objectId: 'kc-2', objectType: 'user' }],
      })
    );
  });

  it('merges mapped users with current Keycloak state and degrades on role projection failures', () => {
    const mapped = {
      id: 'user-1',
      keycloakSubject: 'kc-1',
      displayName: '',
      status: 'active',
      mappingStatus: 'mapped',
      editability: 'editable',
      roles: [],
    } as const;

    expect(
      mergeMappedUserWithKeycloak(
        mapped,
        {
          externalId: 'kc-1',
          firstName: 'Max',
          lastName: 'Mustermann',
          email: 'max@example.org',
          enabled: false,
        },
        null
      )
    ).toEqual({
      ...mapped,
      displayName: 'Max Mustermann',
      email: 'max@example.org',
      status: 'inactive',
      mappingStatus: 'manual_review',
      editability: 'blocked',
      diagnostics: [{ code: 'keycloak_projection_degraded', objectId: 'kc-1', objectType: 'user' }],
    });
  });
});
