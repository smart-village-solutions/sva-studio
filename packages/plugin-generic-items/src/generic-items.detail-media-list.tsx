import { Button, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { mediaContentTypeOptions } from './generic-items.detail-media-content-type.js';
import { MediaPreview, previewPanelClassName } from './generic-items.detail-media-preview.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export function GenericItemsDetailMediaList({
  errors,
  fields,
  mediaContents,
  onRemove,
  labels,
  register,
}: Readonly<{
  errors: FieldErrors<GenericItemsDetailFormValues>;
  fields: readonly { id: string }[];
  mediaContents: GenericItemsDetailFormValues['mediaContents'];
  onRemove: (index: number) => void;
  labels: Record<string, string>;
  register: UseFormRegister<GenericItemsDetailFormValues>;
}>) {
  return (
    <>
      {fields.map((field, index) => {
        const sourceUrlError = errors.mediaContents?.[index]?.sourceUrl?.url;
        const media = mediaContents[index];
        const previewUrl = media?.sourceUrl?.url ?? '';
        const previewAlt = media?.captionText?.trim() || media?.sourceUrl?.description?.trim() || labels.mediaCaption;

        return (
          <article key={field.id} className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
            <div className={previewPanelClassName}>
              <MediaPreview alt={previewAlt} url={previewUrl} />
            </div>
            <div className="space-y-4">
              <StudioFieldGroup columns={2}>
                <StudioField
                  id={`generic-item-media-url-${index}`}
                  label={labels.url}
                  error={sourceUrlError ? labels.validationWebUrls : undefined}
                  errorId={`generic-item-media-url-${index}-error`}
                >
                  <Input
                    id={`generic-item-media-url-${index}`}
                    aria-describedby={sourceUrlError ? `generic-item-media-url-${index}-error` : undefined}
                    aria-invalid={sourceUrlError ? true : undefined}
                    {...register(`mediaContents.${index}.sourceUrl.url`)}
                  />
                </StudioField>
                <StudioField id={`generic-item-media-url-description-${index}`} label={labels.urlDescription}>
                  <Input id={`generic-item-media-url-description-${index}`} {...register(`mediaContents.${index}.sourceUrl.description`)} />
                </StudioField>
                <StudioField id={`generic-item-media-caption-${index}`} label={labels.mediaCaption}>
                  <Input id={`generic-item-media-caption-${index}`} {...register(`mediaContents.${index}.captionText`)} />
                </StudioField>
                <StudioField id={`generic-item-media-copyright-${index}`} label={labels.mediaCopyright}>
                  <Input id={`generic-item-media-copyright-${index}`} {...register(`mediaContents.${index}.copyright`)} />
                </StudioField>
                <StudioField id={`generic-item-media-content-type-${index}`} label={labels.mediaContentType}>
                  <Select id={`generic-item-media-content-type-${index}`} {...register(`mediaContents.${index}.contentType`)}>
                    <option value="">{labels.mediaTypeUnspecified}</option>
                    {mediaContentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {labels[`mediaType${contentType}`]}
                      </option>
                    ))}
                  </Select>
                </StudioField>
              </StudioFieldGroup>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => onRemove(index)}>
                  {labels.removeImage}
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
