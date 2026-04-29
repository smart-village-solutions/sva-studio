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
  for (const role of definition.roles) {
    const normalizedRole = role.trim();
    if (!normalizedRole) {
      throw new Error('invalid_media_picker_roles');
    }
    if (seenRoles.has(normalizedRole)) {
      throw new Error(`duplicate_media_picker_role:${normalizedRole}`);
    }
    seenRoles.add(normalizedRole);
  }

  if (definition.allowedMediaTypes.length === 0 || definition.allowedMediaTypes.some((entry) => entry.trim().length === 0)) {
    throw new Error('invalid_media_picker_media_types');
  }

  return {
    ...definition,
    selectionMode: definition.selectionMode ?? 'single',
  };
};
