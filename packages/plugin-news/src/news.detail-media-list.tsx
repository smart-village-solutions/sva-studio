import { Button, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { UseFormRegister } from 'react-hook-form';

import { mediaContentTypeOptions } from './news.detail-media.helpers.js';
import { MediaPreview, previewPanelClassName } from './news.detail-media-preview.js';
import type { NewsDetailFormValues } from './news.types.js';

export function NewsDetailMediaList({
  fields,
  mediaContents,
  onRemove,
  pt,
  register,
}: Readonly<{
  fields: readonly { id: string }[];
  mediaContents: NewsDetailFormValues['contentMedia'];
  onRemove: (index: number) => void;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  register: UseFormRegister<NewsDetailFormValues>;
}>) {
  return (
    <>
      {fields.map((field, index) => {
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
                <StudioField id={`news-media-url-${index}`} label={pt('fields.mediaUrl')}>
                  <Input id={`news-media-url-${index}`} type="url" {...register(`contentMedia.${index}.sourceUrl.url`)} />
                </StudioField>
                <StudioField id={`news-media-url-description-${index}`} label={pt('fields.mediaUrlDescription')}>
                  <Input id={`news-media-url-description-${index}`} {...register(`contentMedia.${index}.sourceUrl.description`)} />
                </StudioField>
                <StudioField id={`news-media-caption-${index}`} label={pt('fields.mediaCaption')}>
                  <Input id={`news-media-caption-${index}`} {...register(`contentMedia.${index}.captionText`)} />
                </StudioField>
                <StudioField id={`news-media-copyright-${index}`} label={pt('fields.mediaCopyright')}>
                  <Input id={`news-media-copyright-${index}`} {...register(`contentMedia.${index}.copyright`)} />
                </StudioField>
                <StudioField id={`news-media-content-type-${index}`} label={pt('fields.mediaContentType')}>
                  <Select id={`news-media-content-type-${index}`} {...register(`contentMedia.${index}.contentType`)}>
                    <option value="">{pt('values.mediaContentTypes.unspecified')}</option>
                    {mediaContentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {pt(`values.mediaContentTypes.${contentType}`)}
                      </option>
                    ))}
                  </Select>
                </StudioField>
                <StudioField id={`news-media-width-${index}`} label={pt('fields.mediaWidth')}>
                  <Input id={`news-media-width-${index}`} {...register(`contentMedia.${index}.width`)} />
                </StudioField>
                <StudioField id={`news-media-height-${index}`} label={pt('fields.mediaHeight')}>
                  <Input id={`news-media-height-${index}`} {...register(`contentMedia.${index}.height`)} />
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
