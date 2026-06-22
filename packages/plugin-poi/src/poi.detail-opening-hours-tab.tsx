import { Button, Checkbox, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { createDefaultOpeningHour } from './poi.detail-form.defaults.js';
import { POI_OPENING_HOUR_WEEKDAYS } from './poi.opening-hours.js';

type PoiDetailOpeningHoursRowProps = Readonly<{
  index: number;
  isRemovable: boolean;
  isOpen: boolean;
  onRemove: () => void;
  pt: (key: string) => string;
}>;

function PoiDetailOpeningHoursRow({
  index,
  isRemovable,
  isOpen,
  onRemove,
  pt,
}: PoiDetailOpeningHoursRowProps) {
  const { register } = useFormContext<PoiDetailFormValues>();

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between bg-muted px-4 py-3 text-card-foreground">
        <h4 className="text-base font-semibold">{pt('cards.openingHours.entry.title')}</h4>
        {isRemovable ? (
          <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
            {pt('actions.remove')}
          </Button>
        ) : (
          <div className="h-9" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-4 p-4">
        <StudioFieldGroup columns={2}>
          <StudioField id={`poi-opening-date-from-${index}`} label={pt('fields.dateFrom')}>
            <Input id={`poi-opening-date-from-${index}`} type="date" {...register(`content.openingHours.${index}.dateFrom`)} />
          </StudioField>
          <StudioField id={`poi-opening-date-to-${index}`} label={pt('fields.dateTo')}>
            <Input id={`poi-opening-date-to-${index}`} type="date" {...register(`content.openingHours.${index}.dateTo`)} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id={`poi-opening-time-from-${index}`} label={pt('fields.timeFrom')}>
            <Input id={`poi-opening-time-from-${index}`} type="time" {...register(`content.openingHours.${index}.timeFrom`)} />
          </StudioField>
          <StudioField id={`poi-opening-time-to-${index}`} label={pt('fields.timeTo')}>
            <Input id={`poi-opening-time-to-${index}`} type="time" {...register(`content.openingHours.${index}.timeTo`)} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id={`poi-opening-description-${index}`} label={pt('fields.description')}>
            <Input id={`poi-opening-description-${index}`} {...register(`content.openingHours.${index}.description`)} />
          </StudioField>
          <StudioField id={`poi-opening-weekday-${index}`} label={pt('fields.weekday')}>
            <Select id={`poi-opening-weekday-${index}`} {...register(`content.openingHours.${index}.weekday`)}>
              <option value="">{pt('values.notAvailable')}</option>
              {POI_OPENING_HOUR_WEEKDAYS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {pt(`values.weekdays.${weekday}`)}
                </option>
              ))}
            </Select>
          </StudioField>
        </StudioFieldGroup>
        <div className="flex items-center">
          <StudioField id={`poi-opening-open-${index}`} label={pt('fields.open')}>
            <Checkbox id={`poi-opening-open-${index}`} checked={isOpen} {...register(`content.openingHours.${index}.open`)} />
          </StudioField>
        </div>
      </div>
    </section>
  );
}

export function PoiDetailOpeningHoursTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, watch } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.openingHours' });

  return (
    <PoiDetailSectionCard
      title={pt('cards.openingHours.entries.title')}
      description={pt('cards.openingHours.entries.description')}
    >
      {fields.map((field, index) => {
        const isOpen = watch(`content.openingHours.${index}.open`) ?? false;

        return (
          <PoiDetailOpeningHoursRow
            key={field.id}
            index={index}
            isRemovable={fields.length > 1}
            isOpen={isOpen}
            onRemove={() => remove(index)}
            pt={pt}
          />
        );
      })}
      <Button type="button" variant="outline" onClick={() => append(createDefaultOpeningHour())}>
        {pt('actions.addOpeningHour')}
      </Button>
    </PoiDetailSectionCard>
  );
}
