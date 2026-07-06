import { Button, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { EventsDetailFormValues } from './events.detail-form.js';
import { mediaContentTypeOptions } from './events.detail-media.helpers.js';
import { MediaPreview, previewPanelClassName } from './events.detail-media-preview.js';

export function EventsDetailMediaList({
  fields,
  mediaContents,
  onRemove,
  pt,
  register,
}: Readonly<{
  errors: FieldErrors<EventsDetailFormValues>;
  fields: readonly { id: string }[];
  mediaContents: EventsDetailFormValues['content']['mediaContents'];
  onRemove: (index: number) => void;
  pt: (key: string) => string;
  register: UseFormRegister<EventsDetailFormValues>;
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
                <StudioField id={`event-media-url-${index}`} label={pt('fields.url')}>
                  <Input id={`event-media-url-${index}`} {...register(`content.mediaContents.${index}.sourceUrl.url`)} />
                </StudioField>
                <StudioField id={`event-media-url-description-${index}`} label={pt('fields.urlDescription')}>
                  <Input id={`event-media-url-description-${index}`} {...register(`content.mediaContents.${index}.sourceUrl.description`)} />
                </StudioField>
                <StudioField id={`event-media-caption-${index}`} label={pt('fields.mediaCaption')}>
                  <Input id={`event-media-caption-${index}`} {...register(`content.mediaContents.${index}.captionText`)} />
                </StudioField>
                <StudioField id={`event-media-copyright-${index}`} label={pt('fields.mediaCopyright')}>
                  <Input id={`event-media-copyright-${index}`} {...register(`content.mediaContents.${index}.copyright`)} />
                </StudioField>
                <StudioField id={`event-media-content-type-${index}`} label={pt('fields.mediaContentType')}>
                  <Select id={`event-media-content-type-${index}`} {...register(`content.mediaContents.${index}.contentType`)}>
                    <option value="">{pt('values.mediaContentTypes.unspecified')}</option>
                    {mediaContentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {pt(`values.mediaContentTypes.${contentType}`)}
                      </option>
                    ))}
                  </Select>
                </StudioField>
                <StudioField id={`event-media-width-${index}`} label={pt('fields.mediaWidth')}>
                  <Input id={`event-media-width-${index}`} {...register(`content.mediaContents.${index}.width`)} />
                </StudioField>
                <StudioField id={`event-media-height-${index}`} label={pt('fields.mediaHeight')}>
                  <Input id={`event-media-height-${index}`} {...register(`content.mediaContents.${index}.height`)} />
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
