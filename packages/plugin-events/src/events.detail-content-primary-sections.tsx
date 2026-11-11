import { useEffect, useState, type ReactNode } from 'react';
import { useFieldArray, useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { Button, Checkbox, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { createDefaultDate, type EventsDetailFormValues } from './events.detail-form.js';
import { StudioDetailCard } from '@sva/studio-ui-react';
import { EventsDateInput } from './events.detail-date-input.js';
import { compactEventString } from './events.detail-form-serialization-common.js';
import {
  ContentInput,
  indexedId,
  repeatedItemKey,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';

const dirty = { shouldDirty: true } as const;
export function useEventsMapCapabilities() {
  const [geocodingEnabled, setGeocodingEnabled] = useState(true);
  const [reverseGeocodingEnabled, setReverseGeocodingEnabled] = useState(true);
  const [mapEnabled, setMapEnabled] = useState(true);
  const [mapStyleUrl, setMapStyleUrl] = useState('');

  useEffect(() => {
    let active = true;
    void getHostMapGeocodingConfig()
      .then((config) => {
        if (!active) return;
        setGeocodingEnabled(config.geocodeEnabled);
        setReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setGeocodingEnabled(false);
        setReverseGeocodingEnabled(false);
        setMapEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { geocodingEnabled, mapEnabled, mapStyleUrl, reverseGeocodingEnabled };
}

export type EventsMapCapabilities = ReturnType<typeof useEventsMapCapabilities>;
type EventDate = NonNullable<EventsDetailFormValues['content']['dates']>[number];
type DateFieldsProps = Readonly<{
  date: EventDate;
  index: number;
  pt: Translator;
  setValue: UseFormSetValue<EventsDetailFormValues>;
}>;

function DateFields(props: DateFieldsProps) {
  const { date, index, pt, setValue } = props;
  return (
    <>
      <StudioFieldGroup columns={2}>
        <EventsDateInput index={index} name="dateStart" pt={pt} />
        <EventsDateInput index={index} name="dateEnd" pt={pt} />
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <ContentInput
          id={indexedId('event-time-start', index)}
          label={pt('fields.timeStart')}
          type="time"
          value={date.timeStart}
          onChange={(value) => setValue(`content.dates.${index}.timeStart`, value, dirty)}
        />
        <ContentInput
          id={indexedId('event-time-end', index)}
          label={pt('fields.timeEnd')}
          type="time"
          value={date.timeEnd}
          onChange={(value) => setValue(`content.dates.${index}.timeEnd`, value, dirty)}
        />
      </StudioFieldGroup>
      <DateExtrasFields date={date} index={index} pt={pt} setValue={setValue} />
    </>
  );
}

const hasDateExtrasValues = (date: EventDate) =>
  compactEventString(date.weekday) !== undefined ||
  compactEventString(date.timeDescription) !== undefined ||
  date.useOnlyTimeDescription === true;

function DateExtrasFields({ date, index, pt, setValue }: DateFieldsProps) {
  // Derived once per mount. Date rows are keyed by their field-array id, which react-hook-form
  // regenerates on reset, so a newly loaded event recomputes this; keep that key stable per row.
  const [open, setOpen] = useState(() => hasDateExtrasValues(date));
  const onlyTimeDescriptionId = indexedId('event-only-time-description', index);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {pt('fields.dateExtras')}{' '}
        <span className="sr-only">{pt('fields.dateExtrasPosition', { position: index + 1 })}</span>
      </summary>
      <div className="mt-4 space-y-4">
        <StudioFieldGroup columns={2}>
          <ContentInput
            id={indexedId('event-weekday', index)}
            label={pt('fields.weekday')}
            description={pt('fields.weekdayHelp')}
            value={date.weekday}
            onChange={(value) => setValue(`content.dates.${index}.weekday`, value, dirty)}
          />
          <ContentInput
            id={indexedId('event-time-description', index)}
            label={pt('fields.timeDescription')}
            description={pt('fields.timeDescriptionHelp')}
            value={date.timeDescription}
            onChange={(value) => setValue(`content.dates.${index}.timeDescription`, value, dirty)}
          />
        </StudioFieldGroup>
        <StudioField
          id={onlyTimeDescriptionId}
          label={pt('fields.useOnlyTimeDescription')}
          description={pt('fields.useOnlyTimeDescriptionHelp')}
          controlProps={{
            id: onlyTimeDescriptionId,
            'aria-describedby': `${onlyTimeDescriptionId}-description`,
          }}
        >
          <Checkbox
            id={onlyTimeDescriptionId}
            checked={date.useOnlyTimeDescription ?? false}
            onChange={(event) =>
              setValue(`content.dates.${index}.useOnlyTimeDescription`, event.target.checked, dirty)
            }
          />
        </StudioField>
      </div>
    </details>
  );
}

export type EventsDateSectionProps = Readonly<{
  children?: ReactNode;
  pt: Translator;
}>;

export function EventsDateSection(props: EventsDateSectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'content.dates' });
  const dates = useWatch({ control, name: 'content.dates' }) ?? [];
  const renderedDates =
    datesArray.fields.length > 0
      ? datesArray.fields.map((field, index) => dates[index] ?? field)
      : [createDefaultDate()];

  return (
    <StudioDetailCard
      title={props.pt('cards.content.dates.title')}
      description={props.pt('cards.content.dates.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => datesArray.append(createDefaultDate())}
        >
          {props.pt('actions.addDate')}
        </Button>
      }
    >
      {renderedDates.map((date, index) => (
        <RepeaterItem
          key={repeatedItemKey(datesArray.fields[index]?.id, `fallback-date-${index}`)}
          title={props.pt('cards.content.dates.itemTitle')}
          removeLabel={props.pt('actions.remove')}
          onRemove={dates.length > 1 ? () => datesArray.remove(index) : undefined}
        >
          <DateFields date={date} index={index} pt={props.pt} setValue={setValue} />
        </RepeaterItem>
      ))}
      {props.children}
    </StudioDetailCard>
  );
}
