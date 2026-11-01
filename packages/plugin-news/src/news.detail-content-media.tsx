import {
  ContentMediaUsageBlock,
  Select,
  StudioField,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { StudioDetailCard } from '@sva/studio-ui-react';
import {
  createNewsMediaUsageLabels,
  type ContentFieldBindings,
} from './news.detail-content-tab.helpers.js';
import type { NewsDetailContentTabProps } from './news.detail-content-tab.js';

type NewsContentMediaSectionProps = Readonly<{
  pt: NewsDetailContentTabProps['pt'];
  mediaField: ContentFieldBindings;
  mediaUsages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  mediaEditingDisabled: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onAddManualMedia: () => string;
}>;

export function NewsContentMediaSection({
  pt,
  mediaField,
  mediaUsages,
  onChange,
  canSelectMedia,
  canUploadMedia,
  mediaEditingDisabled,
  onLoadAssetSnapshot,
  onAddManualMedia,
  onOpenMediaPicker,
}: NewsContentMediaSectionProps) {
  return (
    <StudioDetailCard
      title={pt('cards.content.media.title')}
      description={pt('cards.content.media.description')}
    >
      <div id={mediaField.id}>
        <ContentMediaUsageBlock
          disabled={mediaEditingDisabled}
          usages={mediaUsages}
          onChange={onChange}
          onAddManual={onAddManualMedia}
          onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
          onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
          onLoadAssetSnapshot={onLoadAssetSnapshot}
          supportedFields={{ altText: true, caption: true, credit: true, license: false }}
          showHeader={false}
          renderAdditionalFields={({ usage, update }) => (
            <StudioField
              id={`content-media-${usage.uiId}-content-type`}
              label={pt('fields.mediaContentType')}
            >
              <Select
                id={`content-media-${usage.uiId}-content-type`}
                value={String(usage.additionalData?.contentType ?? '')}
                onChange={(event) =>
                  update({
                    additionalData: {
                      ...usage.additionalData,
                      contentType: event.currentTarget.value,
                    },
                  })
                }
              >
                <option value="">{pt('values.mediaContentTypes.unspecified')}</option>
                <option value="image">{pt('values.mediaContentTypes.image')}</option>
              </Select>
            </StudioField>
          )}
          labels={createNewsMediaUsageLabels(pt)}
        />
      </div>
    </StudioDetailCard>
  );
}
