import {
  Button,
  Checkbox,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { GENERIC_ITEMS_OPENING_HOUR_WEEKDAYS } from './generic-items.constants.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const OpeningDateTimeFields = ({
  labels,
  index,
  openingHour,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  openingHour: GenericItemsDetailFormValues['openingHours'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-opening-date-from-${index}`} label={labels.dateFrom}>
          <Input
            id={`generic-item-opening-date-from-${index}`}
            type="date"
            value={openingHour.dateFrom}
            onChange={(event) =>
              setValue(`openingHours.${index}.dateFrom`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-opening-date-to-${index}`} label={labels.dateTo}>
          <Input
            id={`generic-item-opening-date-to-${index}`}
            type="date"
            value={openingHour.dateTo}
            onChange={(event) =>
              setValue(`openingHours.${index}.dateTo`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-opening-time-from-${index}`} label={labels.timeFrom}>
          <Input
            id={`generic-item-opening-time-from-${index}`}
            type="time"
            value={openingHour.timeFrom}
            onChange={(event) =>
              setValue(`openingHours.${index}.timeFrom`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-opening-time-to-${index}`} label={labels.timeTo}>
          <Input
            id={`generic-item-opening-time-to-${index}`}
            type="time"
            value={openingHour.timeTo}
            onChange={(event) =>
              setValue(`openingHours.${index}.timeTo`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
      </StudioFieldGroup>
    </>
  );
};

const OpeningDetailFields = ({
  labels,
  index,
  openingHour,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  openingHour: GenericItemsDetailFormValues['openingHours'][number];
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-opening-description-${index}`} label={labels.description}>
          <Input
            id={`generic-item-opening-description-${index}`}
            value={openingHour.description}
            onChange={(event) =>
              setValue(`openingHours.${index}.description`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-opening-weekday-${index}`} label={labels.weekday}>
          <Select
            id={`generic-item-opening-weekday-${index}`}
            value={openingHour.weekday}
            onChange={(event) =>
              setValue(`openingHours.${index}.weekday`, event.target.value, {
                shouldDirty: true,
              })
            }
          >
            <option value="">{labels.notAvailable}</option>
            {GENERIC_ITEMS_OPENING_HOUR_WEEKDAYS.map((weekday) => (
              <option key={weekday} value={weekday}>
                {labels[`weekday${weekday}`]}
              </option>
            ))}
          </Select>
        </StudioField>
      </StudioFieldGroup>
      <div className="flex items-center">
        <StudioField id={`generic-item-opening-open-${index}`} label={labels.open}>
          <Checkbox
            id={`generic-item-opening-open-${index}`}
            checked={openingHour.open}
            onChange={(event) =>
              setValue(`openingHours.${index}.open`, event.currentTarget.checked, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
      </div>
    </>
  );
};

const OpeninghourRow = ({
  labels,
  index,
  openingHour,
  canRemove,
  onRemove,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  openingHour: GenericItemsDetailFormValues['openingHours'][number];
}> &
  Readonly<{ canRemove: boolean; onRemove: () => void }>) => (
  <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
    <div className="flex items-center justify-between bg-muted px-4 py-3 text-card-foreground">
      <h4 className="text-base font-semibold">{labels.openingHourItem}</h4>
      {canRemove ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => onRemove()}>
          {labels.remove}
        </Button>
      ) : (
        <div className="h-9" aria-hidden="true" />
      )}
    </div>
    <div className="space-y-4 p-4">
      <OpeningDateTimeFields labels={labels} index={index} openingHour={openingHour} />
      <OpeningDetailFields labels={labels} index={index} openingHour={openingHour} />{' '}
    </div>
  </section>
);

export const GenericItemsContentOpeningHours = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const openingHoursArray = useFieldArray({ control, name: 'openingHours' });
  const openingHours = useWatch({ control, name: 'openingHours' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.openingHours}</p>
          <p className="text-sm text-muted-foreground">{labels.openingHoursHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            openingHoursArray.append({
              weekday: '',
              dateFrom: '',
              dateTo: '',
              timeFrom: '',
              timeTo: '',
              description: '',
              open: false,
            })
          }
        >
          {labels.addOpeningHour}
        </Button>
      </div>
      {openingHours.map((openingHour, index) => (
        <OpeninghourRow
          key={openingHoursArray.fields[index]?.id ?? `fallback-openingHour-${index}`}
          labels={labels}
          index={index}
          openingHour={openingHour}
          canRemove={openingHours.length > 1}
          onRemove={() => openingHoursArray.remove(index)}
        />
      ))}
    </div>
  );
};
