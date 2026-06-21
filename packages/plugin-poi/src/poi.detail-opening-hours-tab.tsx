import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailOpeningHoursTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, register } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.openingHours' });

  return (
    <PoiDetailSectionCard
      title={pt('cards.openingHours.entries.title')}
      description={pt('cards.openingHours.entries.description')}
    >
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <StudioFieldGroup columns={2}>
            <StudioField id={`poi-opening-weekday-${index}`} label={pt('fields.weekday')}>
              <Input id={`poi-opening-weekday-${index}`} {...register(`content.openingHours.${index}.weekday`)} />
            </StudioField>
            <StudioField id={`poi-opening-time-from-${index}`} label={pt('fields.timeFrom')}>
              <Input id={`poi-opening-time-from-${index}`} {...register(`content.openingHours.${index}.timeFrom`)} />
            </StudioField>
          </StudioFieldGroup>
          <div className="mt-4 flex items-center justify-between">
            <StudioField id={`poi-opening-open-${index}`} label={pt('fields.open')}>
              <Checkbox id={`poi-opening-open-${index}`} {...register(`content.openingHours.${index}.open`)} />
            </StudioField>
            {fields.length > 1 ? (
              <Button type="button" variant="outline" onClick={() => remove(index)}>
                {pt('actions.remove')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => append({ weekday: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', open: true, description: '' })}
      >
        {pt('actions.add')}
      </Button>
    </PoiDetailSectionCard>
  );
}
