import {
  ContentMediaUsageBlock,
  StudioDetailCard,
  StudioField,
  Textarea,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import type * as React from 'react';
import { useForm } from 'react-hook-form';

import { cockpitCardUsagesToMedia } from './cockpit-cards.content-media-adapter.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

function contentMediaLabels(pt: (key: string) => string) {
  return {
    title: pt('fields.images'),
    description: pt('media.description'),
    empty: pt('media.empty'),
    actions: {
      add: pt('media.add'),
      remove: pt('actions.removeImage'),
      moveUp: pt('actions.moveImageUp'),
      moveDown: pt('actions.moveImageDown'),
      refreshMetadata: pt('media.refresh'),
      cancel: pt('media.cancel'),
      apply: pt('media.apply'),
    },
    fields: {
      url: pt('fields.imageUrl'),
      altText: pt('media.altText'),
      caption: pt('media.caption'),
      credit: pt('media.credit'),
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
}

export function ContentFields({
  form,
  pt,
  mediaUsages,
  onMediaUsagesChange,
  canSelectMedia,
  canUploadMedia,
  mediaEditingDisabled,
  onAddManualMedia,
  onOpenMediaPicker,
  onLoadAssetSnapshot,
}: Readonly<{
  form: ReturnType<typeof useForm<CockpitCardFormValues>>;
  pt: (key: string) => string;
  mediaUsages: readonly ContentMediaUsage[];
  onMediaUsagesChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  mediaEditingDisabled: boolean;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onLoadAssetSnapshot: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) {
  const changeUsages = (next: readonly ContentMediaUsage[]) => {
    onMediaUsagesChange(next);
    form.setValue('images', [...cockpitCardUsagesToMedia(next)], { shouldDirty: true });
  };
  return (
    <div className="space-y-5">
      <StudioDetailCard title={pt('fields.text')}>
        <StudioField id="cockpit-card-text" label={pt('fields.text')}>
          <Textarea
            id="cockpit-card-text"
            className="min-h-32"
            aria-invalid={Boolean(form.formState.errors.text)}
            {...form.register('text')}
          />
        </StudioField>
      </StudioDetailCard>
      <StudioDetailCard title={pt('fields.images')}>
        <ContentMediaUsageBlock
          disabled={mediaEditingDisabled}
          usages={mediaUsages}
          onChange={changeUsages}
          onAddManual={onAddManualMedia}
          onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
          onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
          onLoadAssetSnapshot={onLoadAssetSnapshot}
          showHeader={false}
          supportedFields={{ altText: true, caption: false, credit: false, license: false }}
          labels={contentMediaLabels(pt)}
        />
        {form.formState.errors.images ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('validation.images')}
          </p>
        ) : null}
      </StudioDetailCard>
    </div>
  );
}
