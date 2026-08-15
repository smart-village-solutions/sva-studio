import type { IamUserDetail } from '@sva/core';
import { describe, expect, it } from 'vitest';

import {
  buildProfileUpdatePayload,
  deriveProfileDisplayName,
  deriveProfileProjectionDetails,
  getProfileLoadErrorTranslationKey,
  readAccountActionStatus,
  toProfileFormValues,
  validateProfileForm,
} from './-account-profile-model';

const createProfile = (overrides: Partial<IamUserDetail> = {}): IamUserDetail => ({
  id: 'profile-1',
  keycloakSubject: 'subject-1',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  status: 'active',
  isTechnicalAccount: false,
  roles: [],
  mainserverUserApplicationSecretSet: false,
  ...overrides,
});

describe('account profile model', () => {
  it('derives form defaults without a React or translation dependency', () => {
    expect(toProfileFormValues(createProfile())).toEqual({
      firstName: '',
      lastName: '',
      phone: '',
      position: '',
      department: '',
      preferredLanguage: 'de',
    });
  });

  it('normalizes the mutation payload and derives its display name', () => {
    expect(
      buildProfileUpdatePayload({
        firstName: ' Jane ',
        lastName: ' Doe ',
        phone: ' ',
        position: ' Editor ',
        department: '',
        preferredLanguage: ' en ',
      })
    ).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      phone: undefined,
      position: 'Editor',
      department: undefined,
      preferredLanguage: 'en',
    });
    expect(deriveProfileDisplayName(' ', ' Doe ')).toBe('Doe');
  });

  it('returns stable validation codes for required names and invalid phone values', () => {
    expect(
      validateProfileForm({
        firstName: ' ',
        lastName: '',
        phone: 'invalid',
        position: '',
        department: '',
        preferredLanguage: 'de',
      })
    ).toEqual({
      firstName: 'firstNameRequired',
      lastName: 'lastNameRequired',
      phone: 'phoneInvalid',
    });
    expect(
      validateProfileForm({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+49 1234567',
        position: '',
        department: '',
        preferredLanguage: 'de',
      })
    ).toEqual({});
  });

  it.each([
    ['password-updated', 'password-updated'],
    ['email-update-finished', 'email-update-finished'],
    ['email-update-unavailable', 'email-update-unavailable'],
    ['cancelled', 'cancelled'],
    ['unexpected', null],
  ] as const)('accepts only the supported account action %s', (value, expected) => {
    expect(readAccountActionStatus(`?accountAction=${value}`)).toBe(expected);
  });

  it('treats missing browser search input as no account action', () => {
    expect(readAccountActionStatus(undefined)).toBeNull();
    expect(readAccountActionStatus('')).toBeNull();
  });

  it.each([
    [401, undefined, undefined, 'account.diagnostics.sessionRecovery'],
    [
      500,
      undefined,
      'actor_resolution_or_membership',
      'account.diagnostics.actorResolutionOrMembership',
    ],
    [500, undefined, 'database_or_schema_drift', 'account.diagnostics.databaseOrSchemaDrift'],
    [
      500,
      undefined,
      'registry_or_provisioning_drift',
      'account.diagnostics.registryOrProvisioningDrift',
    ],
    [500, undefined, 'keycloak_dependency', 'account.diagnostics.keycloakDependency'],
    [500, undefined, 'keycloak_reconcile', 'account.diagnostics.keycloakDependency'],
    [500, undefined, undefined, 'account.messages.loadError'],
  ] as const)(
    'maps status %s and classification %s to the existing load-error translation',
    (status, recommendedAction, classification, expected) => {
      expect(getProfileLoadErrorTranslationKey({ status, recommendedAction, classification })).toBe(
        expected
      );
    }
  );

  it('derives optional projection labels and diagnostics', () => {
    expect(
      deriveProfileProjectionDetails(
        createProfile({
          mappingStatus: 'manual_review',
          editability: 'blocked',
          diagnostics: [{ code: 'keycloak_projection_degraded' }],
        })
      )
    ).toEqual({
      diagnosticCodes: 'keycloak_projection_degraded',
      editabilityTranslationKey: 'account.projection.editability.blocked',
      hasWarning: true,
      mappingStatusTranslationKey: 'account.projection.mappingStatus.manualReview',
    });
    expect(deriveProfileProjectionDetails(null)).toEqual({
      diagnosticCodes: null,
      editabilityTranslationKey: null,
      hasWarning: false,
      mappingStatusTranslationKey: null,
    });
  });
});
