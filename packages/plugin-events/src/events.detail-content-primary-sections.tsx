import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { Button, Checkbox, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { createDefaultDate, type EventsDetailFormValues } from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import {
  ContentInput,
  indexedId,
  repeatedItemKey,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';

const dirty = { shouldDirty: true } as const;
const firstDateInvalid = (index: number, invalid: boolean) =>
  index === 0 && invalid ? true : undefined;
const firstDateValue = (index: number, input: string, stored?: string) =>
  index === 0 ? input : stored;

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
  dateEndInput: string;
  dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
  dateStartInput: string;
  index: number;
  onDateEndChange: (value: string) => void;
  onDateStartChange: (value: string) => void;
  pt: Translator;
  setValue: UseFormSetValue<EventsDetailFormValues>;
}>;

function DateFields(props: DateFieldsProps) {
  const { date, dateEndInput, dateInputsInvalid, dateStartInput, index, pt, setValue } = props;
  return (
    <>
      <StudioFieldGroup columns={2}>
        <ContentInput
          id={indexedId('event-date-start', index)}
          label={pt('fields.dateStart')}
          type="date"
          ariaInvalid={firstDateInvalid(index, dateInputsInvalid.dateStart)}
          value={firstDateValue(index, dateStartInput, date.dateStart)}
          onChange={props.onDateStartChange}
        />
        <ContentInput
          id={indexedId('event-date-end', index)}
          label={pt('fields.dateEnd')}
          type="date"
          ariaInvalid={firstDateInvalid(index, dateInputsInvalid.dateEnd)}
          value={firstDateValue(index, dateEndInput, date.dateEnd)}
          onChange={props.onDateEndChange}
        />
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
      <StudioFieldGroup columns={2}>
        <ContentInput
          id={`event-weekday-${index}`}
          label={pt('fields.weekday')}
          value={date.weekday}
          onChange={(value) => setValue(`content.dates.${index}.weekday`, value, dirty)}
        />
        <ContentInput
          id={`event-time-description-${index}`}
          label={pt('fields.timeDescription')}
          value={date.timeDescription}
          onChange={(value) => setValue(`content.dates.${index}.timeDescription`, value, dirty)}
        />
      </StudioFieldGroup>
      <StudioField
        id={`event-only-time-description-${index}`}
        label={pt('fields.useOnlyTimeDescription')}
      >
        <Checkbox
          id={`event-only-time-description-${index}`}
          checked={date.useOnlyTimeDescription ?? false}
          onChange={(event) =>
            setValue(`content.dates.${index}.useOnlyTimeDescription`, event.target.checked, dirty)
          }
        />
      </StudioField>
    </>
  );
}

export type EventsDateSectionProps = Readonly<{
  dateEndInput: string;
  dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
  dateStartInput: string;
  onDateEndInputChange: (nextValue: string) => void;
  onDateStartInputChange: (nextValue: string) => void;
  pt: Translator;
}>;

export function EventsDateSection(props: EventsDateSectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'content.dates' });
  const dates = useWatch({ control, name: 'content.dates' }) ?? [];
  const renderedDates = dates.length > 0 ? dates : [createDefaultDate()];
  const changeDate = (index: number, name: 'dateStart' | 'dateEnd', value: string) => {
    if (index > 0) return setValue(`content.dates.${index}.${name}`, value, dirty);
    return name === 'dateStart'
      ? props.onDateStartInputChange(value)
      : props.onDateEndInputChange(value);
  };

  return (
    <EventsDetailCard
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
          <DateFields
            {...props}
            date={date}
            index={index}
            setValue={setValue}
            onDateStartChange={(value) => changeDate(index, 'dateStart', value)}
            onDateEndChange={(value) => changeDate(index, 'dateEnd', value)}
          />
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}
