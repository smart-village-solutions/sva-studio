import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const DateTimeFields = ({
  labels,
  index,
  date,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  date: GenericItemsDetailFormValues['dates'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-date-start-${index}`} label={labels.dateStart}>
          <Input
            id={`generic-item-date-start-${index}`}
            type="datetime-local"
            value={date.dateStart}
            onChange={(event) =>
              setValue(`dates.${index}.dateStart`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-date-end-${index}`} label={labels.dateEnd}>
          <Input
            id={`generic-item-date-end-${index}`}
            type="datetime-local"
            value={date.dateEnd}
            onChange={(event) =>
              setValue(`dates.${index}.dateEnd`, event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-time-start-${index}`} label={labels.timeStart}>
          <Input
            id={`generic-item-time-start-${index}`}
            type="time"
            value={date.timeStart}
            onChange={(event) =>
              setValue(`dates.${index}.timeStart`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-time-end-${index}`} label={labels.timeEnd}>
          <Input
            id={`generic-item-time-end-${index}`}
            type="time"
            value={date.timeEnd}
            onChange={(event) =>
              setValue(`dates.${index}.timeEnd`, event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
      </StudioFieldGroup>
    </>
  );
};

const DateDetailFields = ({
  labels,
  index,
  date,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  date: GenericItemsDetailFormValues['dates'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-weekday-${index}`} label={labels.weekday}>
          <Input
            id={`generic-item-weekday-${index}`}
            value={date.weekday}
            onChange={(event) =>
              setValue(`dates.${index}.weekday`, event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-time-description-${index}`} label={labels.timeDescription}>
          <Input
            id={`generic-item-time-description-${index}`}
            value={date.timeDescription}
            onChange={(event) =>
              setValue(`dates.${index}.timeDescription`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
      </StudioFieldGroup>
      <StudioField
        id={`generic-item-use-only-time-description-${index}`}
        label={labels.useOnlyTimeDescription}
      >
        <Checkbox
          id={`generic-item-use-only-time-description-${index}`}
          checked={date.useOnlyTimeDescription}
          onChange={(event) =>
            setValue(`dates.${index}.useOnlyTimeDescription`, event.currentTarget.checked, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </>
  );
};

const DateRow = ({
  labels,
  index,
  date,
  canRemove,
  onRemove,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  date: GenericItemsDetailFormValues['dates'][number];
}> &
  Readonly<{ canRemove: boolean; onRemove: () => void }>) => (
  <div className="space-y-4 rounded-xl border border-border/60 p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-foreground">{labels.dateItem}</p>
      {canRemove ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
          {labels.remove}
        </Button>
      ) : null}
    </div>
    <DateTimeFields labels={labels} index={index} date={date} />
    <DateDetailFields labels={labels} index={index} date={date} />
  </div>
);

export const GenericItemsContentDates = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'dates' });
  const dates = useWatch({ control, name: 'dates' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.dates}</p>
          <p className="text-sm text-muted-foreground">{labels.datesHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            datesArray.append({
              weekday: '',
              dateStart: '',
              dateEnd: '',
              timeStart: '',
              timeEnd: '',
              timeDescription: '',
              useOnlyTimeDescription: false,
            })
          }
        >
          {labels.addDate}
        </Button>
      </div>
      {dates.map((date, index) => (
        <DateRow
          key={datesArray.fields[index]?.id ?? `fallback-date-${index}`}
          labels={labels}
          index={index}
          date={date}
          canRemove={dates.length > 1}
          onRemove={() => datesArray.remove(index)}
        />
      ))}
    </div>
  );
};
