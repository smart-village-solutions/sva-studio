import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';

type CollectionLocationDialogMode = 'create' | 'edit';

export const getCollectionLocationDialogText = (
  pt: (key: string) => string,
  mode: CollectionLocationDialogMode,
  saving: boolean
): Readonly<{ description: string; submitLabel: string; title: string }> => {
  const title =
    mode === 'create'
      ? pt('masterData.collectionLocations.dialog.createTitle')
      : pt('masterData.collectionLocations.dialog.editTitle');
  const description =
    mode === 'create'
      ? pt('masterData.collectionLocations.dialog.createDescription')
      : pt('masterData.collectionLocations.dialog.editDescription');

  let submitLabel = pt('masterData.collectionLocations.actions.save');
  if (saving) {
    submitLabel = pt('masterData.collectionLocations.actions.saving');
  } else if (mode === 'create') {
    submitLabel = pt('masterData.collectionLocations.actions.create');
  }

  return { description, submitLabel, title };
};

export const applyCollectionLocationFormPatch = (
  setValue: (
    key: keyof CollectionLocationFormState,
    value: CollectionLocationFormState[keyof CollectionLocationFormState],
    options: { shouldDirty: boolean; shouldTouch: boolean; shouldValidate: boolean }
  ) => void,
  patch: Partial<CollectionLocationFormState>
): void => {
  for (const [key, value] of Object.entries(patch) as Array<
    [keyof CollectionLocationFormState, CollectionLocationFormState[keyof CollectionLocationFormState]]
  >) {
    setValue(key, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }
};
