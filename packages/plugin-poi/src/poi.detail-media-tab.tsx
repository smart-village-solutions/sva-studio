import { ContentMediaUsageBlock, createManualContentMediaUsage, Select, StudioField, type ContentMediaUsage } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { poiMediaContentsToUsages, poiMediaUsagesToContents } from './poi.content-media-adapter.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import { mediaContentTypeOptions } from './poi.detail-media-content-type.js';

type PoiTranslator = (key: string) => string;

const createPoiMediaUsageLabels = (pt: PoiTranslator) => ({
  title: pt('cards.media.entries.title'), description: pt('cards.media.entries.description'), empty: pt('messages.imagePickerEmpty'),
  actions: {
    library: pt('actions.addImage'), upload: pt('actions.uploadMedia'), manual: pt('actions.addMediaManual'),
    remove: pt('actions.removeImage'), moveUp: pt('messages.mediaMoveUp'), moveDown: pt('messages.mediaMoveDown'),
    refreshMetadata: pt('messages.mediaRefreshMetadata'), cancel: pt('actions.back'), apply: pt('messages.mediaApplyMetadata'),
  },
  fields: {
    url: pt('fields.url'), altText: pt('messages.mediaPickerAltText'), caption: pt('fields.mediaCaption'),
    credit: pt('fields.mediaCopyright'), license: pt('messages.mediaPickerLicense'),
  },
  states: {
    linked: pt('messages.mediaLinked'), manual: pt('messages.mediaManual'), synced: pt('messages.mediaReferenceSynced'),
    pending: pt('messages.mediaReferencePending'), missing: pt('messages.mediaReferenceMissing'),
    additional: pt('messages.mediaReferenceAdditional'), unresolved: pt('messages.mediaReferenceUnresolved'),
    failed: pt('messages.mediaReferenceFailed'), previewUnavailable: pt('messages.mediaPreviewUnavailable'),
  },
  announcements: { moved: pt('messages.mediaMoved'), removed: pt('messages.mediaRemoved') },
  refresh: {
    title: pt('messages.mediaRefreshTitle'), description: pt('messages.mediaRefreshDescription'),
    assetValue: pt('messages.mediaAssetValue'), contentValue: pt('messages.mediaContentValue'),
  },
});

const PoiMediaContentTypeField = ({
  usage, update, pt,
}: Readonly<{
  usage: ContentMediaUsage;
  update: (patch: Partial<Omit<ContentMediaUsage, 'uiId'>>) => void;
  pt: PoiTranslator;
}>) => (
  <StudioField id={`content-media-${usage.uiId}-content-type`} label={pt('fields.mediaContentType')}>
    <Select
      id={`content-media-${usage.uiId}-content-type`}
      value={typeof usage.additionalData?.contentType === 'string' ? usage.additionalData.contentType : ''}
      onChange={(event) => update({ additionalData: { ...usage.additionalData, contentType: event.currentTarget.value } })}
    >
      <option value="">{pt('values.mediaContentTypes.unspecified')}</option>
      {mediaContentTypeOptions.map((contentType) => (
        <option key={contentType} value={contentType}>{pt(`values.mediaContentTypes.${contentType}`)}</option>
      ))}
    </Select>
  </StudioField>
);

export function PoiDetailMediaTab({
  mediaUsages,
  canSelectMedia = false,
  canUploadMedia = false,
  onChangeMediaUsages = () => undefined,
  onLoadAssetSnapshot = async () => { throw new Error('asset_refresh_unavailable'); },
  onOpenMediaPicker,
  pt,
}: Readonly<{
  mediaUsages?: readonly ContentMediaUsage[];
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  onLoadAssetSnapshot?: NonNullable<React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot']>;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  pt: (key: string) => string;
}>) {
  const { control, formState, setValue } = useFormContext<PoiDetailFormValues>();
  const watchedMedia = useWatch({ control, name: 'content.mediaContents' }) ?? [];
  const resolvedUsages = mediaUsages ?? poiMediaContentsToUsages(watchedMedia);
  const mediaErrors = Object.fromEntries(
    resolvedUsages.flatMap((usage, index) => {
      const message = formState.errors.content?.mediaContents?.[index]?.sourceUrl?.url?.message;
      return typeof message === 'string' ? [[`${usage.uiId}.persistentUrl`, pt('validation.webUrls')]] : [];
    })
  );
  const change = (usages: readonly ContentMediaUsage[]) => {
    onChangeMediaUsages(usages);
    setValue('content.mediaContents', poiMediaUsagesToContents(usages), { shouldDirty: true });
  };

  return (
    <PoiDetailSectionCard title={pt('cards.media.entries.title')} description={pt('cards.media.entries.description')}>
      <ContentMediaUsageBlock
        usages={resolvedUsages}
        errors={mediaErrors}
        onChange={change}
        onAddManual={() => change([...resolvedUsages, createManualContentMediaUsage({ sortOrder: resolvedUsages.length })])}
        onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
        onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        supportedFields={{ altText: true, caption: true, credit: true, license: false }}
        showHeader={false}
        renderAdditionalFields={({ usage, update }) => <PoiMediaContentTypeField usage={usage} update={update} pt={pt} />}
        labels={createPoiMediaUsageLabels(pt)}
      />
    </PoiDetailSectionCard>
  );
}
