import { usePluginTranslation } from './plugin-translations.js';

/** Fixed host-media namespace for shared picker UI; no general plugin SDK access. */
export const useContentMediaTranslation = () => usePluginTranslation('media');

export {
  resolveContentMediaCapabilities,
  type ContentMediaCapabilities,
} from './content-media-permissions.js';
export {
  alignHostMediaReferencesByOrder,
  contentMediaSavePhaseMessageKey,
  saveContentWithHostMediaReferences,
  type ContentMediaReferenceAlignment,
  type ContentMediaReferenceSyncResult,
  type ContentMediaDraftResolution,
  type ContentMediaLocalDraft,
  type ContentMediaSavePhase,
  ContentMediaSaveError,
} from './content-media-persistence.js';
export type { UpdateHostMediaMetadataInput } from './media-picker-client.js';
export { listHostMediaAssets } from './media-picker-client.js';
export { waitForHostMediaUpload } from './media-upload-client.js';

export type {
  HostMediaUploadMetadata,
  HostMediaEditingUpload,
  HostMediaEditingUploadPayload,
} from './media-upload-client.js';
export { getHostMediaEditing, type HostMediaEditingData } from './media-picker-client.js';
