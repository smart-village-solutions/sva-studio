import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';

export const createLocalStudioMediaPickerAsset = (input: {
  readonly file: File;
  readonly draftId: string;
  readonly previewUrl: string;
}): StudioMediaPickerAssetDetail => ({
  id: input.draftId,
  title: input.file.name,
  fileName: input.file.name,
  previewUrl: input.previewUrl,
  persistentUrl: input.previewUrl,
  mimeType: input.file.type,
  visibility: 'public',
  metadata: { title: input.file.name, altText: '', description: '', copyright: '', license: '' },
  localDraft: { id: input.draftId, file: input.file },
});
