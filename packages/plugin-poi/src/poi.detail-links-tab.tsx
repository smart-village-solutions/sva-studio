import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailLinksTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, register } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.webUrls' });

  return (
    <PoiDetailSectionCard title={pt('cards.links.entries.title')} description={pt('cards.links.entries.description')}>
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <StudioFieldGroup columns={2}>
            <StudioField id={`poi-link-url-${index}`} label={pt('fields.url')}>
              <Input id={`poi-link-url-${index}`} {...register(`content.webUrls.${index}.url`)} />
            </StudioField>
            <StudioField id={`poi-link-description-${index}`} label={pt('fields.urlDescription')}>
              <Input id={`poi-link-description-${index}`} {...register(`content.webUrls.${index}.description`)} />
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
      ))}
      <Button type="button" variant="outline" onClick={() => append({ url: '', description: '' })}>
        {pt('actions.add')}
      </Button>
    </PoiDetailSectionCard>
  );
}
