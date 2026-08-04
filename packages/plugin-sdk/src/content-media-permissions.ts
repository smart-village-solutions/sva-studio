export type ContentMediaCapabilities = Readonly<{
  canSelect: boolean;
  canUpload: boolean;
  canEditAssetMetadata: boolean;
}>;

export const resolveContentMediaCapabilities = (input: {
  readonly canEditContent: boolean;
  readonly permissionActions: readonly string[];
}): ContentMediaCapabilities => {
  const actions = new Set(input.permissionActions);
  const canSelect = input.canEditContent && actions.has('media.read') && actions.has('media.reference.manage');
  return {
    canSelect,
    canUpload: canSelect && actions.has('media.create'),
    canEditAssetMetadata: canSelect && actions.has('media.update'),
  };
};
