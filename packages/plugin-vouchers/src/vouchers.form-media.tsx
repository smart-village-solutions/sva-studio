import { useRef } from 'react';
import {
  ContentMediaUsageBlock,
  isPersistableContentMediaUrl,
  isPersistableManualContentMediaUrl,
  createContentMediaUiId,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { VoucherMediaOverlay, useVoucherMediaPicker } from './vouchers.media.js';
import { useVoucherAccess } from './vouchers.access.js';
import type { VoucherFormProps } from './vouchers.form-fields.js';

const createVoucherMediaUsageLabels = (pt: (key: string) => string) => ({
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

const toVoucherMedia = (
  usage: ContentMediaUsage,
  original: VoucherFormProps['draft']['mediaContents'][number] | undefined
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

export function VoucherMediaFields({ draft, change, errors }: VoucherFormProps) {
  const t = usePluginTranslation('vouchers');
  const access = useVoucherAccess();
  const ids = useRef(new WeakMap<object, string>());
  const canSelect =
    access.permissionActions.includes('media.read') &&
    access.permissionActions.includes('media.reference.manage');
  const usages: readonly ContentMediaUsage[] = draft.mediaContents.map((media, sortOrder) => {
    let uiId = ids.current.get(media);
    if (!uiId) {
      uiId = createContentMediaUiId();
      ids.current.set(media, uiId);
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
  const addManual = () => {
    const media = { contentType: 'image', sourceUrl: { url: '' } };
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
        const media = toVoucherMedia(usage, original);
        ids.current.set(media, usage.uiId);
        return media;
      })
    );
  };
  const media = useVoucherMediaPicker((selected) =>
    change('mediaContents', [...draft.mediaContents, selected])
  );
  return (
    <>
      <ContentMediaUsageBlock
        errors={Object.fromEntries(
          usages
            .filter(
              (usage) =>
                errors.includes('mediaContents') &&
                !(usage.assetId
                  ? isPersistableContentMediaUrl(usage.persistentUrl)
                  : isPersistableManualContentMediaUrl(usage.persistentUrl))
            )
            .map((usage) => [`${usage.uiId}.persistentUrl`, t('messages.mediaUrlInvalid')])
        )}
        usages={usages}
        onChange={updateUsages}
        onAddManual={addManual}
        onOpenLibrary={canSelect ? media.picker.openLibrary : undefined}
        onOpenUpload={
          canSelect && media.capabilities.canUpload ? media.picker.openUpload : undefined
        }
        labels={createVoucherMediaUsageLabels(t)}
      />
      <VoucherMediaOverlay media={media} onAddManual={addManual} />
    </>
  );
}
