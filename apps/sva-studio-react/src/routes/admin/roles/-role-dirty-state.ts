export type NormalizedRoleGeneralDraft = Readonly<{
  displayName: string;
  description: string;
}>;

export type NormalizedRolePermissionDraft = Readonly<{
  permissionId: string;
  accessScope?: 'all' | 'own' | 'organization';
}>;

export const normalizeRoleGeneralDraft = (input: {
  readonly displayName: string;
  readonly description?: string | null;
}): NormalizedRoleGeneralDraft => ({
  displayName: input.displayName.trim(),
  description: input.description?.trim() ?? '',
});

export const areRoleGeneralDraftsEqual = (
  left: NormalizedRoleGeneralDraft,
  right: NormalizedRoleGeneralDraft
): boolean => left.displayName === right.displayName && left.description === right.description;

export const areRolePermissionDraftsEqual = (
  left: readonly NormalizedRolePermissionDraft[],
  right: readonly NormalizedRolePermissionDraft[]
): boolean =>
  left.length === right.length &&
  left.every(
    (assignment, index) =>
      assignment.permissionId === right[index]?.permissionId &&
      assignment.accessScope === right[index]?.accessScope
  );
