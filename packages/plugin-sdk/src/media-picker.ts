export type MediaPickerSelectionMode = 'single' | 'multiple';

export type MediaPickerDefinition = Readonly<{
  roles: readonly string[];
  allowedMediaTypes: readonly string[];
  selectionMode?: MediaPickerSelectionMode;
  presetKey?: string;
}>;

export const defineMediaPickerDefinition = <const TDefinition extends MediaPickerDefinition>(
  definition: TDefinition
): TDefinition & Readonly<{ selectionMode: MediaPickerSelectionMode }> => {
  if (definition.roles.length === 0) {
    throw new Error('invalid_media_picker_roles');
  }

  const seenRoles = new Set<string>();
  const normalizedRoles = definition.roles.map((role) => {
    const normalizedRole = role.trim();
    if (!normalizedRole) {
      throw new Error('invalid_media_picker_roles');
    }
    if (seenRoles.has(normalizedRole)) {
      throw new Error(`duplicate_media_picker_role:${normalizedRole}`);
    }
    seenRoles.add(normalizedRole);
    return normalizedRole;
  });

  const normalizedAllowedMediaTypes = definition.allowedMediaTypes.map((entry) => entry.trim());
  if (normalizedAllowedMediaTypes.length === 0 || normalizedAllowedMediaTypes.some((entry) => entry.length === 0)) {
    throw new Error('invalid_media_picker_media_types');
  }

  return {
    ...definition,
    roles: normalizedRoles,
    allowedMediaTypes: normalizedAllowedMediaTypes,
    selectionMode: definition.selectionMode ?? 'single',
  };
};
