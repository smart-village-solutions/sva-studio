import type { IamUserDetail } from '@sva/core';

export type SessionProfileSeed = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
};

const normalizeSeedValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const buildSeedDisplayName = (input: SessionProfileSeed): string | undefined => {
  const explicitDisplayName = normalizeSeedValue(input.displayName);
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [normalizeSeedValue(input.firstName), normalizeSeedValue(input.lastName)]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  return fullName || normalizeSeedValue(input.username);
};

export const buildNormalizedSessionProfile = (
  sessionProfile: SessionProfileSeed | undefined
): {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
} => ({
  username: normalizeSeedValue(sessionProfile?.username),
  email: normalizeSeedValue(sessionProfile?.email),
  firstName: normalizeSeedValue(sessionProfile?.firstName),
  lastName: normalizeSeedValue(sessionProfile?.lastName),
  displayName: buildSeedDisplayName(sessionProfile ?? {}),
});

const isMissingOrPlaceholder = (value: string | undefined, placeholder?: string): boolean => {
  const normalizedValue = normalizeSeedValue(value);
  if (!normalizedValue) {
    return true;
  }
  return placeholder !== undefined && normalizedValue === placeholder;
};

export const shouldRepairProfileFromSession = (
  detail: IamUserDetail | undefined,
  sessionProfile: ReturnType<typeof buildNormalizedSessionProfile>
): boolean => {
  if (!detail) {
    return false;
  }

  return (
    (sessionProfile.username !== undefined && isMissingOrPlaceholder(detail.username)) ||
    (sessionProfile.email !== undefined && isMissingOrPlaceholder(detail.email)) ||
    (sessionProfile.firstName !== undefined && isMissingOrPlaceholder(detail.firstName)) ||
    (sessionProfile.lastName !== undefined && isMissingOrPlaceholder(detail.lastName)) ||
    (sessionProfile.displayName !== undefined &&
      isMissingOrPlaceholder(detail.displayName, detail.keycloakSubject))
  );
};
