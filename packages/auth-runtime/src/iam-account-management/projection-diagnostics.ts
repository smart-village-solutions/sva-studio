import type { IamUserDetail } from '@sva/core';

export const appendProjectionDiagnostic = (
  diagnostics: IamUserDetail['diagnostics'],
  diagnostic: NonNullable<IamUserDetail['diagnostics']>[number]
): NonNullable<IamUserDetail['diagnostics']> => {
  const existingDiagnostics = diagnostics ?? [];
  return existingDiagnostics.some((entry) => entry.code === diagnostic.code)
    ? existingDiagnostics
    : [...existingDiagnostics, diagnostic];
};

export const markUserProjectionDegraded = (user: IamUserDetail): IamUserDetail => ({
  ...user,
  mappingStatus: 'manual_review',
  editability: 'blocked',
  diagnostics: appendProjectionDiagnostic(user.diagnostics, {
    code: 'keycloak_projection_degraded',
    objectId: user.id,
    objectType: 'user',
  }),
  fieldEditability: {
    profile: user.fieldEditability?.profile ?? 'editable',
    status: user.fieldEditability?.status ?? 'read_only',
    roles: 'blocked',
  },
});
