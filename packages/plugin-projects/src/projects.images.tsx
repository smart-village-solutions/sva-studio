import { getHostMediaAsset, getHostMediaDelivery } from '@sva/plugin-sdk';
import { resolveProjectPersistentDeliveryUrl } from './projects.content-media-adapter.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentMediaUsageBlock,
  StudioDetailCard,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import type { ComponentProps } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { projectMediaUsagesToImages } from './projects.content-media-adapter.js';
import type { ProjectFormValues } from './projects.validation.js';

type Translate = ReturnType<typeof usePluginTranslation>;

export function ProjectImages({
  form,
  pt,
  usages,
  onChange,
  canSelectMedia,
  canUploadMedia,
  mediaEditingDisabled,
  onAddManualMedia,
  onOpenMediaPicker,
  onLoadAssetSnapshot,
}: Readonly<{
  form: UseFormReturn<ProjectFormValues>;
  pt: Translate;
  usages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  mediaEditingDisabled: boolean;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onLoadAssetSnapshot: ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) {
  const change = (next: readonly ContentMediaUsage[]) => {
    onChange(next);
    form.setValue('images', [...projectMediaUsagesToImages(next)], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <StudioDetailCard title={pt('fields.images')} description={pt('create.optional')}>
      <ContentMediaUsageBlock
        disabled={mediaEditingDisabled}
        usages={usages}
        onChange={change}
        showHeader={false}
        onAddManual={onAddManualMedia}
        onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
        onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        supportedFields={{ altText: true, caption: true, credit: true, license: false }}
        labels={projectImagesLabels(pt)}
      />
    </StudioDetailCard>
  );
}

const projectImagesLabels = (pt: Translate) => {
  return {
    title: pt('fields.images'),
    description: pt('media.description'),
    empty: pt('messages.imagePreviewEmpty'),
    actions: {
      add: pt('media.add'),
      remove: pt('actions.removeImage'),
      moveUp: pt('actions.moveImageUp'),
      moveDown: pt('actions.moveImageDown'),
      refreshMetadata: pt('media.refresh'),
      cancel: pt('actions.back'),
      apply: pt('media.apply'),
    },
    fields: {
      url: pt('fields.imageUrl'),
      altText: pt('fields.altText'),
      caption: pt('fields.caption'),
      credit: pt('fields.credits'),
      license: pt('media.license'),
    },
    states: {
      linked: pt('media.linked'),
      manual: pt('media.manual'),
      synced: pt('media.synced'),
      pending: pt('media.pending'),
      missing: pt('media.missing'),
      additional: pt('media.additional'),
      unresolved: pt('media.unresolved'),
      failed: pt('media.failed'),
      previewUnavailable: pt('messages.imagePreviewEmpty'),
    },
    announcements: { moved: pt('media.moved'), removed: pt('media.removed') },
    urlFeedback: {
      upgradedToHttps: pt('media.urlUpgradedToHttps'),
      insecureHttp: pt('media.urlInsecureHttp'),
      httpsUnavailable: pt('media.urlHttpsUnavailable'),
      invalid: pt('media.urlInvalid'),
    },
    refresh: {
      title: pt('media.refreshTitle'),
      description: pt('media.refreshDescription'),
      assetValue: pt('media.assetValue'),
      contentValue: pt('media.contentValue'),
    },
  };
};

export async function loadProjectAssetSnapshot(usage: ContentMediaUsage) {
  if (!usage.assetId) throw new Error('asset_unavailable');
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
  ]);
  const persistentUrl = resolveProjectPersistentDeliveryUrl(delivery);
  if (!persistentUrl) throw new Error('asset_unavailable');
  return {
    persistentUrl,
    altText: asset.metadata.altText ?? '',
    caption: asset.metadata.description ?? '',
    credit: asset.metadata.copyright ?? '',
    license: asset.metadata.license ?? '',
  };
}
