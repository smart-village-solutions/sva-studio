import {
  Button,
  ContentMediaUsageBlock,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type React from 'react';
import { genericItemMediaUsagesToFormValues } from './generic-items.content-media-adapter.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const createMediaLabels = (labels: Record<string, string>) => {
  return {
    title: labels.linksMediaTitle,
    description: labels.linksMediaDescription,
    empty: labels.mediaUsageEmpty,
    actions: {
      add: labels.mediaPickerTitle,
      remove: labels.removeImage,
      moveUp: labels.mediaMoveUp,
      moveDown: labels.mediaMoveDown,
      refreshMetadata: labels.mediaRefresh,
      cancel: labels.mediaCancel,
      apply: labels.mediaApply,
    },
    fields: {
      url: labels.url,
      altText: labels.urlDescription,
      caption: labels.mediaCaption,
      credit: labels.mediaCopyright,
      license: labels.mediaLicense,
    },
    states: {
      linked: labels.mediaLinked,
      manual: labels.mediaManual,
      synced: labels.mediaSynced,
      pending: labels.mediaPending,
      missing: labels.mediaMissing,
      additional: labels.mediaAdditional,
      unresolved: labels.mediaUnresolved,
      failed: labels.mediaFailed,
      previewUnavailable: labels.mediaPreviewUnavailable,
    },
    announcements: { moved: labels.mediaMoved, removed: labels.mediaRemoved },
    urlFeedback: {
      upgradedToHttps: labels.mediaUrlUpgradedToHttps,
      insecureHttp: labels.mediaUrlInsecureHttp,
      httpsUnavailable: labels.mediaUrlHttpsUnavailable,
      invalid: labels.mediaUrlInvalid,
    },
    refresh: {
      title: labels.mediaRefreshTitle,
      description: labels.mediaRefreshDescription,
      assetValue: labels.mediaAssetValue,
      contentValue: labels.mediaContentValue,
    },
  };
};

const GenericItemsWebUrls = ({ labels }: Readonly<{ labels: Record<string, string> }>) => {
  const { control, setValue } = useFormContext<GenericItemsDetailFormValues>();
  const webUrlsArray = useFieldArray({ control, name: 'webUrls' });
  const webUrls = useWatch({ control, name: 'webUrls' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.webUrls}</p>
          <p className="text-sm text-muted-foreground">{labels.webUrlsHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => webUrlsArray.append({ url: '', description: '' })}
        >
          {labels.addLink}
        </Button>
      </div>
      {webUrls.map((webUrl, index) => (
        <div
          key={webUrlsArray.fields[index]?.id ?? `fallback-web-url-${index}`}
          className="space-y-4 rounded-xl border border-border/60 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{labels.linkItem}</p>
            {webUrls.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => webUrlsArray.remove(index)}
              >
                {labels.remove}
              </Button>
            ) : null}
          </div>
          <StudioFieldGroup columns={2}>
            <StudioField id={`generic-item-web-url-${index}`} label={labels.url}>
              <Input
                id={`generic-item-web-url-${index}`}
                value={webUrl.url}
                onChange={(event) =>
                  setValue(`webUrls.${index}.url`, event.target.value, { shouldDirty: true })
                }
              />
            </StudioField>
            <StudioField
              id={`generic-item-web-url-description-${index}`}
              label={labels.urlDescription}
            >
              <Input
                id={`generic-item-web-url-description-${index}`}
                value={webUrl.description}
                onChange={(event) =>
                  setValue(`webUrls.${index}.description`, event.target.value, {
                    shouldDirty: true,
                  })
                }
              />
            </StudioField>
          </StudioFieldGroup>
        </div>
      ))}
    </div>
  );
};

export const GenericItemsContentLinksMedia = ({
  labels,
  onAddManualMedia,
  onOpenMediaPicker,
  mediaUsages,
  onChangeMediaUsages = () => undefined,
  canSelectMedia = true,
  canUploadMedia = true,
  mediaEditingDisabled = false,
  onLoadAssetSnapshot,
}: Readonly<{
  labels: Record<string, string>;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) => {
  const { control, setValue } = useFormContext<GenericItemsDetailFormValues>();
  const mediaContents = useWatch({ control, name: 'mediaContents' }) ?? [];
  const resolvedMediaUsages = mediaUsages ?? mainserverContentMediaToUsages(mediaContents);
  const changeMediaUsages = (usages: readonly ContentMediaUsage[]) => {
    onChangeMediaUsages(usages);
    setValue('mediaContents', genericItemMediaUsagesToFormValues(usages), { shouldDirty: true });
  };
  return (
    <GenericItemsDetailCard
      title={labels.linksMediaTitle}
      description={labels.linksMediaDescription}
    >
      <div className="space-y-5">
        <ContentMediaUsageBlock
          disabled={mediaEditingDisabled}
          usages={resolvedMediaUsages}
          onChange={changeMediaUsages}
          onAddManual={onAddManualMedia}
          onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
          onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
          onLoadAssetSnapshot={onLoadAssetSnapshot}
          supportedFields={{ altText: true, caption: true, credit: true, license: false }}
          showHeader={false}
          renderAdditionalFields={({ usage, update }) => (
            <StudioField
              id={`generic-item-media-${usage.uiId}-content-type`}
              label={labels.mediaContentType}
            >
              <Select
                id={`generic-item-media-${usage.uiId}-content-type`}
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
                <option value="">{labels.mediaTypeUnspecified}</option>
                <option value="image">{labels.mediaTypeimage}</option>
                <option value="audio">{labels.mediaTypeaudio}</option>
                <option value="video">{labels.mediaTypevideo}</option>
                <option value="logo">{labels.mediaTypelogo}</option>
                <option value="attachment">{labels.mediaTypeattachment}</option>
              </Select>
            </StudioField>
          )}
          labels={createMediaLabels(labels)}
        />
      </div>
      <GenericItemsWebUrls labels={labels} />
    </GenericItemsDetailCard>
  );
};
