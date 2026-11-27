import {
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  createManualContentMediaUsage,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import { useState, useSyncExternalStore } from 'react';

import { audioRole, initialAudio, type AudioUsages } from './tour-audio-data.js';
import { useTourAudioLibrary } from './tour-audio-library.js';
import { useTourAudioReferences } from './tour-audio-references.js';
import { tourAudioTarget, type EditableTour } from './tour-edit-data.js';

const audioUsage = (
  persistentUrl: string | undefined,
  sortOrder: number,
  asset?: StudioMediaPickerAssetDetail
) => {
  const usage = createManualContentMediaUsage({ persistentUrl, role: audioRole, sortOrder });
  return {
    ...usage,
    ...(asset
      ? {
          assetId: asset.localDraft ? undefined : asset.id,
          previewUrl: asset.previewUrl ?? undefined,
          localDraft: asset.localDraft,
          caption: asset.metadata.description || asset.title,
          credit: asset.metadata.copyright,
          referenceStatus: 'pending' as const,
        }
      : {}),
    additionalData: { contentType: 'audio' },
  };
};

export function useTourAudio(
  tour: EditableTour | undefined,
  canEdit: boolean,
  onChanged: () => void,
  instanceId?: string
) {
  const pt = usePluginTranslation('tours');
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const mediaInstanceId = instanceId ?? access.instanceId;
  const { canSelect, canUpload } = resolveContentMediaCapabilities({
    canEditContent: canEdit,
    permissionActions: access.permissionActions,
  });
  const references = useTourAudioReferences(tour, canSelect, mediaInstanceId);
  const [audio, setAudio] = useState(() => initialAudio(tour));
  const [audioChanged, setAudioChanged] = useState(false);
  const [target, setTarget] = useState(tourAudioTarget);
  const change = (key: string, next: readonly ContentMediaUsage[]) => {
    setAudio((previous) => ({ ...previous, [key]: next }));
    setAudioChanged(true);
    onChanged();
  };
  const add = (key: string, url?: string, asset?: StudioMediaPickerAssetDetail) => {
    const current = audio[key] ?? [];
    const usage = audioUsage(url, current.length, asset);
    change(key, [...current, usage]);
    return usage.uiId;
  };
  const library = useTourAudioLibrary(mediaInstanceId, (asset) => {
    add(target, asset.localDraft ? undefined : (asset.persistentUrl ?? undefined), asset);
  });
  const open = (key: string, mode: 'library' | 'upload') => {
    setTarget(key);
    if (mode === 'upload') library.picker.openUpload();
    else {
      library.picker.openLibrary();
      void library.refreshAssetList();
    }
  };
  const usagesFor = (targets: readonly string[]) =>
    targets
      .flatMap((key) => audio[key] ?? [])
      .map((usage, sortOrder) => references.withReference({ ...usage, sortOrder }));
  const withReferences: AudioUsages = Object.fromEntries(
    Object.entries(audio).map(([key, usages]) => [key, usages.map(references.withReference)])
  );
  return {
    ...library,
    pt,
    target,
    mediaInstanceId,
    change,
    addManual: add,
    open,
    usagesFor,
    audio: withReferences,
    canSelect: canSelect && references.status === 'ready',
    canUpload: canUpload && references.status === 'ready',
    referenceStatus: references.status,
    audioChanged,
    retryReferences: references.retry,
    shouldSync: (targets: readonly string[]) => references.syncNeeded(usagesFor(targets)),
  };
}
