import { Button, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import { mediaContentTypeOptions } from './poi.detail-media-content-type.js';
import { MediaPreview, previewPanelClassName } from './poi.detail-media-preview.js';

export function PoiDetailMediaList({
  errors,
  fields,
  mediaContents,
  onRemove,
  pt,
  register,
}: Readonly<{
  errors: FieldErrors<PoiDetailFormValues>;
  fields: readonly { id: string }[];
  mediaContents: PoiDetailFormValues['content']['mediaContents'];
  onRemove: (index: number) => void;
  pt: (key: string) => string;
  register: UseFormRegister<PoiDetailFormValues>;
}>) {
  return (
    <>
      {fields.map((field, index) => {
        const sourceUrlError = errors.content?.mediaContents?.[index]?.sourceUrl?.url;
        const media = mediaContents[index];
        const previewUrl = media?.sourceUrl?.url ?? '';
        const previewAlt = media?.captionText?.trim() || media?.sourceUrl?.description?.trim() || pt('fields.mediaCaption');

        return (
          <article key={field.id} className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
            <div className={previewPanelClassName}>
              <MediaPreview alt={previewAlt} url={previewUrl} />
            </div>
            <div className="space-y-4">
              <StudioFieldGroup columns={2}>
                <StudioField
                  id={`poi-media-url-${index}`}
                  label={pt('fields.url')}
                  error={sourceUrlError ? pt('validation.webUrls') : undefined}
                  errorId={`poi-media-url-${index}-error`}
                >
                  <Input
                    id={`poi-media-url-${index}`}
                    aria-describedby={sourceUrlError ? `poi-media-url-${index}-error` : undefined}
                    aria-invalid={sourceUrlError ? true : undefined}
                    {...register(`content.mediaContents.${index}.sourceUrl.url`)}
                  />
                </StudioField>
                <StudioField id={`poi-media-url-description-${index}`} label={pt('fields.urlDescription')}>
                  <Input id={`poi-media-url-description-${index}`} {...register(`content.mediaContents.${index}.sourceUrl.description`)} />
                </StudioField>
                <StudioField id={`poi-media-caption-${index}`} label={pt('fields.mediaCaption')}>
                  <Input id={`poi-media-caption-${index}`} {...register(`content.mediaContents.${index}.captionText`)} />
                </StudioField>
                <StudioField id={`poi-media-copyright-${index}`} label={pt('fields.mediaCopyright')}>
                  <Input id={`poi-media-copyright-${index}`} {...register(`content.mediaContents.${index}.copyright`)} />
                </StudioField>
                <StudioField id={`poi-media-content-type-${index}`} label={pt('fields.mediaContentType')}>
                  <Select id={`poi-media-content-type-${index}`} {...register(`content.mediaContents.${index}.contentType`)}>
                    <option value="">{pt('values.mediaContentTypes.unspecified')}</option>
                    {mediaContentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {pt(`values.mediaContentTypes.${contentType}`)}
                      </option>
                    ))}
                  </Select>
                </StudioField>
              </StudioFieldGroup>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => onRemove(index)}>
                  {pt('actions.removeImage')}
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
