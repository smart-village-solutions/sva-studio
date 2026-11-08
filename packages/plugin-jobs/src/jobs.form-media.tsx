import { useRef } from 'react';
import {
  ContentMediaUsageBlock,
  isPersistableContentMediaUrl,
  isPersistableManualContentMediaUrl,
  createContentMediaUiId,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { JobMediaOverlay, useJobMediaPicker } from './jobs.media.js';
import { useJobAccess } from './jobs.access.js';
import type { JobFormProps } from './jobs.form.js';

const createJobMediaUsageLabels = (pt: (key: string) => string) => ({
  title: pt('fields.media'),
  description: pt('messages.mediaPickerDescription'),
  empty: pt('messages.imagePickerEmpty'),
  actions: {
    add: pt('media.add'),
    remove: pt('media.remove'),
    moveUp: pt('messages.mediaMoveUp'),
    moveDown: pt('messages.mediaMoveDown'),
    refreshMetadata: pt('messages.mediaRefreshMetadata'),
    cancel: pt('actions.cancel'),
    apply: pt('messages.mediaApplyMetadata'),
  },
  fields: {
    url: pt('media.url'),
    altText: pt('messages.mediaPickerAltText'),
    caption: pt('media.caption'),
    credit: pt('media.copyright'),
    license: pt('messages.mediaPickerLicense'),
  },
  states: {
    linked: pt('messages.mediaLinked'),
    manual: pt('messages.mediaManual'),
    synced: pt('messages.mediaReferenceSynced'),
    pending: pt('messages.mediaReferencePending'),
    missing: pt('messages.mediaReferenceMissing'),
    additional: pt('messages.mediaReferenceAdditional'),
    unresolved: pt('messages.mediaReferenceUnresolved'),
    failed: pt('messages.mediaReferenceFailed'),
    previewUnavailable: pt('messages.mediaPreviewUnavailable'),
  },
  announcements: { moved: pt('messages.mediaMoved'), removed: pt('messages.mediaRemoved') },
  urlFeedback: {
    upgradedToHttps: pt('messages.mediaUrlUpgradedToHttps'),
    insecureHttp: pt('messages.mediaUrlInsecureHttp'),
    httpsUnavailable: pt('messages.mediaUrlHttpsUnavailable'),
    invalid: pt('messages.mediaUrlInvalid'),
  },
  refresh: {
    title: pt('messages.mediaRefreshTitle'),
    description: pt('messages.mediaRefreshDescription'),
    assetValue: pt('messages.mediaAssetValue'),
    contentValue: pt('messages.mediaContentValue'),
  },
});

const toJobMedia = (
  usage: ContentMediaUsage,
  original: JobFormProps['draft']['mediaContents'][number] | undefined
) => ({
  ...original,
  contentType: original?.contentType ?? 'image',
  hostMediaAssetId: original?.sourceUrl.url === usage.persistentUrl ? usage.assetId : undefined,
  sourceUrl: {
    ...original?.sourceUrl,
    url: usage.persistentUrl,
    description: usage.altText,
  },
  captionText: usage.caption,
  copyright: usage.credit,
});

function jobMediaUsages(
  draft: JobFormProps['draft'],
  ids: WeakMap<object, string>
): readonly ContentMediaUsage[] {
  return draft.mediaContents.map((media, sortOrder) => {
    let uiId = ids.get(media);
    if (!uiId) {
      uiId = createContentMediaUiId();
      ids.set(media, uiId);
    }
    return {
      uiId,
      assetId: media.hostMediaAssetId,
      persistentUrl: media.sourceUrl.url,
      altText: media.sourceUrl.description ?? '',
      caption: media.captionText ?? '',
      credit: media.copyright ?? '',
      role: 'gallery_item',
      sortOrder,
      referenceStatus: media.hostMediaAssetId ? 'pending' : 'synced',
    };
  });
}

export function JobMediaFields({ draft, change, errors, disabled }: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  const access = useJobAccess();
  const ids = useRef(new WeakMap<object, string>());
  const canSelect =
    !disabled &&
    access.permissionActions.includes('media.read') &&
    access.permissionActions.includes('media.reference.manage');
  const usages = jobMediaUsages(draft, ids.current);
  const addManual = () => {
    const media = {
      contentType: 'image' as const,
      sourceUrl: { url: '', description: '' },
      captionText: '',
      copyright: '',
    };
    const uiId = createContentMediaUiId();
    ids.current.set(media, uiId);
    change('mediaContents', [...draft.mediaContents, media]);
    return uiId;
  };
  const updateUsages = (next: readonly ContentMediaUsage[]) => {
    change(
      'mediaContents',
      next.map((usage) => {
        const index = usages.findIndex((item) => item.uiId === usage.uiId);
        const original = draft.mediaContents[index];
        const media = toJobMedia(usage, original);
        ids.current.set(media, usage.uiId);
        return media;
      })
    );
  };
  const media = useJobMediaPicker(
    (selected) => change('mediaContents', [...draft.mediaContents, selected]),
    !disabled
  );
  return (
    <>
      <ContentMediaUsageBlock
        showHeader={false}
        disabled={disabled}
        errors={Object.fromEntries(
          usages
            .filter(
              (usage) =>
                errors.some((path) => path.startsWith('mediaContents')) &&
                !(usage.assetId
                  ? isPersistableContentMediaUrl(usage.persistentUrl)
                  : isPersistableManualContentMediaUrl(usage.persistentUrl))
            )
            .map((usage) => [`${usage.uiId}.persistentUrl`, pt('messages.mediaUrlInvalid')])
        )}
        usages={usages}
        onChange={updateUsages}
        onAddManual={addManual}
        onOpenLibrary={canSelect ? media.picker.openLibrary : undefined}
        onOpenUpload={
          canSelect && media.capabilities.canUpload ? media.picker.openUpload : undefined
        }
        labels={createJobMediaUsageLabels(pt)}
      />
      <JobMediaOverlay media={media} onAddManual={addManual} />
    </>
  );
}
