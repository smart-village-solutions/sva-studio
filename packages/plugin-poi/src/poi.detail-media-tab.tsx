import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { createDefaultMediaContent } from './poi.detail-form.defaults.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

export function PoiDetailMediaTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.mediaContents' });

  return (
    <PoiDetailSectionCard title={pt('cards.media.entries.title')} description={pt('cards.media.entries.description')}>
      {fields.map((field, index) => {
        const sourceUrlError = errors.content?.mediaContents?.[index]?.sourceUrl?.url;

        return (
          <div key={field.id} className="rounded-xl border border-border/60 p-4">
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
                <Input id={`poi-media-content-type-${index}`} {...register(`content.mediaContents.${index}.contentType`)} />
              </StudioField>
            </StudioFieldGroup>
            {fields.length > 1 ? (
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="outline" onClick={() => remove(index)}>
                  {pt('actions.remove')}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={() => append(createDefaultMediaContent())}>
        {pt('actions.add')}
      </Button>
    </PoiDetailSectionCard>
  );
}
