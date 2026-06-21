import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailPricesTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, register } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.prices' });

  return (
    <PoiDetailSectionCard title={pt('cards.prices.entries.title')} description={pt('cards.prices.entries.description')}>
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <StudioFieldGroup columns={2}>
            <StudioField id={`poi-price-name-${index}`} label={pt('fields.priceName')}>
              <Input id={`poi-price-name-${index}`} {...register(`content.prices.${index}.name`)} />
            </StudioField>
            <StudioField id={`poi-price-amount-${index}`} label={pt('fields.amount')}>
              <Input id={`poi-price-amount-${index}`} {...register(`content.prices.${index}.amount`)} />
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
      <Button type="button" variant="outline" onClick={() => append({ name: '', amount: '', description: '', category: '' })}>
        {pt('actions.add')}
      </Button>
    </PoiDetailSectionCard>
  );
}
