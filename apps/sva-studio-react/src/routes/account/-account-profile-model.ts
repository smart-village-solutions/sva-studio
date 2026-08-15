import type { IamUserDetail } from '@sva/core';

import type { IamHttpError, UpdateMyProfilePayload } from '../../lib/iam-api';

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
  department: string;
  preferredLanguage: string;
};

export type ProfileField = keyof ProfileFormValues;

export type ProfileValidationError = 'firstNameRequired' | 'lastNameRequired' | 'phoneInvalid';

export type ProfileErrors = Partial<Record<ProfileField, ProfileValidationError>>;

export type AccountActionStatus =
  'password-updated' | 'email-update-finished' | 'email-update-unavailable' | 'cancelled';

export type ProfileLoadErrorTranslationKey =
  | 'account.diagnostics.sessionRecovery'
  | 'account.diagnostics.actorResolutionOrMembership'
  | 'account.diagnostics.databaseOrSchemaDrift'
  | 'account.diagnostics.registryOrProvisioningDrift'
  | 'account.diagnostics.keycloakDependency'
  | 'account.messages.loadError';

type ProjectionMappingTranslationKey =
  | 'account.projection.mappingStatus.mapped'
  | 'account.projection.mappingStatus.unmapped'
  | 'account.projection.mappingStatus.manualReview';

type ProjectionEditabilityTranslationKey =
  | 'account.projection.editability.editable'
  | 'account.projection.editability.readOnly'
  | 'account.projection.editability.blocked';

const mappingStatusTranslationKeyByValue: Record<
  NonNullable<IamUserDetail['mappingStatus']>,
  ProjectionMappingTranslationKey
> = {
  mapped: 'account.projection.mappingStatus.mapped',
  unmapped: 'account.projection.mappingStatus.unmapped',
  manual_review: 'account.projection.mappingStatus.manualReview',
};

const editabilityTranslationKeyByValue: Record<
  NonNullable<IamUserDetail['editability']>,
  ProjectionEditabilityTranslationKey
> = {
  editable: 'account.projection.editability.editable',
  read_only: 'account.projection.editability.readOnly',
  blocked: 'account.projection.editability.blocked',
};

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  position: '',
  department: '',
  preferredLanguage: '',
};

export const toProfileFormValues = (profile: IamUserDetail): ProfileFormValues => ({
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  phone: profile.phone ?? '',
  position: profile.position ?? '',
  department: profile.department ?? '',
  preferredLanguage: profile.preferredLanguage ?? 'de',
});

export const deriveProfileDisplayName = (firstName: string, lastName: string): string =>
  [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

export const buildProfileUpdatePayload = (values: ProfileFormValues): UpdateMyProfilePayload => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  displayName: deriveProfileDisplayName(values.firstName, values.lastName),
  phone: values.phone.trim() || undefined,
  position: values.position.trim() || undefined,
  department: values.department.trim() || undefined,
  preferredLanguage: values.preferredLanguage.trim() || undefined,
});

export const validateProfileForm = (values: ProfileFormValues): ProfileErrors => {
  const errors: ProfileErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'firstNameRequired';
  }
  if (!values.lastName.trim()) {
    errors.lastName = 'lastNameRequired';
  }
  if (values.phone.trim() && !/^\+?[0-9()\-\s]{6,20}$/.test(values.phone.trim())) {
    errors.phone = 'phoneInvalid';
  }

  return errors;
};

export const readAccountActionStatus = (search: string | undefined): AccountActionStatus | null => {
  if (search === undefined) {
    return null;
  }

  const accountAction = new URLSearchParams(search).get('accountAction');
  if (
    accountAction === 'password-updated' ||
    accountAction === 'email-update-finished' ||
    accountAction === 'email-update-unavailable' ||
    accountAction === 'cancelled'
  ) {
    return accountAction;
  }

  return null;
};

export const deriveProfileProjectionDetails = (profile: IamUserDetail | null) => ({
  diagnosticCodes: profile?.diagnostics?.map((diagnostic) => diagnostic.code).join(', ') ?? null,
  editabilityTranslationKey: profile?.editability
    ? editabilityTranslationKeyByValue[profile.editability]
    : null,
  hasWarning: profile?.mappingStatus === 'manual_review' || Boolean(profile?.diagnostics?.length),
  mappingStatusTranslationKey: profile?.mappingStatus
    ? mappingStatusTranslationKeyByValue[profile.mappingStatus]
    : null,
});

export const getProfileLoadErrorTranslationKey = (
  error: Pick<IamHttpError, 'classification' | 'recommendedAction' | 'status'>
): ProfileLoadErrorTranslationKey => {
  if (error.recommendedAction === 'erneut_anmelden' || error.status === 401) {
    return 'account.diagnostics.sessionRecovery';
  }

  switch (error.classification) {
    case 'actor_resolution_or_membership':
      return 'account.diagnostics.actorResolutionOrMembership';
    case 'database_or_schema_drift':
      return 'account.diagnostics.databaseOrSchemaDrift';
    case 'registry_or_provisioning_drift':
      return 'account.diagnostics.registryOrProvisioningDrift';
    case 'keycloak_dependency':
    case 'keycloak_reconcile':
      return 'account.diagnostics.keycloakDependency';
    default:
      return 'account.messages.loadError';
  }
};
