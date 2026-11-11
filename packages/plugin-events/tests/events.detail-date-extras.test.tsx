import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { EventsDateSection } from '../src/events.detail-content-primary-sections.js';
import {
  createDefaultEventsDetailFormValues,
  type EventsDetailFormValues,
} from '../src/events.detail-form.js';

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    getHostMapGeocodingConfig: async () => ({
      provider: 'geoapify' as const,
      styleUrl: '',
      killSwitchEnabled: true,
      geocodeEnabled: false,
      reverseGeocodeEnabled: false,
    }),
  };
});

const translations: Readonly<Record<string, string>> = {
  'cards.content.dates.title': 'Termine',
  'cards.content.dates.description': 'Termine, Zeiten und optionale Hinweise zur Zeit.',
  'cards.content.dates.itemTitle': 'Termin',
  'fields.dateExtras': 'Weitere Terminangaben (optional)',
  'fields.dateExtrasPosition': 'zu Termin {{position}}',
  'fields.dateStart': 'Startdatum',
  'fields.dateEnd': 'Enddatum',
  'fields.timeStart': 'Startzeit',
  'fields.timeEnd': 'Endzeit',
  'fields.weekday': 'Wochentag (optional)',
  'fields.weekdayHelp':
    'Bei einem konkreten Datum müssen Sie den Wochentag nicht zusätzlich eintragen.',
  'fields.timeDescription': 'Hinweis zur Zeit (optional)',
  'fields.timeDescriptionHelp': 'Zusätzliche Angaben zur Zeit.',
  'fields.useOnlyTimeDescription': 'Nur den Hinweis zur Zeit anzeigen',
  'fields.useOnlyTimeDescriptionHelp': 'Verwendet die bestehende Ausgabeoption des Mainservers.',
  'actions.addDate': 'Termin hinzufügen',
  'actions.remove': 'Entfernen',
};
const pt = (key: string, variables?: Readonly<Record<string, string | number>>) =>
  (translations[key] ?? key).replace('{{position}}', String(variables?.position ?? ''));

type EventDateValue = NonNullable<EventsDetailFormValues['content']['dates']>[number];

const emptyDate = (overrides: Partial<EventDateValue> = {}): EventDateValue => ({
  weekday: '',
  dateStart: '2026-06-12',
  dateEnd: '',
  timeStart: '',
  timeEnd: '',
  timeDescription: '',
  useOnlyTimeDescription: false,
  ...overrides,
});

function renderDates(dates: readonly EventDateValue[]) {
  let form: UseFormReturn<EventsDetailFormValues> | undefined;
  const defaults = createDefaultEventsDetailFormValues();

  const Wrapper = () => {
    const methods = useForm<EventsDetailFormValues>({
      defaultValues: { ...defaults, content: { ...defaults.content, dates: [...dates] } },
    });
    form = methods;
    return (
      <FormProvider {...methods}>
        <EventsDateSection pt={pt} />
      </FormProvider>
    );
  };

  render(<Wrapper />);
  return { form: () => form as UseFormReturn<EventsDetailFormValues> };
}

const extrasSections = () =>
  Array.from(document.querySelectorAll('details')).filter((element) =>
    element.querySelector('summary')?.textContent?.startsWith('Weitere Terminangaben (optional)')
  );

const extrasSection = (position = 0): HTMLDetailsElement => {
  const section = extrasSections()[position];
  if (!section) throw new Error(`Missing extras section ${position}`);
  return section;
};

const toggle = (section: HTMLDetailsElement) => {
  const summary = section.querySelector('summary');
  if (!summary) throw new Error('Missing summary');
  fireEvent.click(summary);
};

describe('EventsDateSection – weitere Terminangaben', () => {
  it('shows a visible, collapsed extras section for an empty date', () => {
    renderDates([emptyDate()]);

    const section = extrasSection();
    expect(section.open).toBe(false);
    expect(section.querySelector('summary')?.hidden).toBe(false);
    expect(screen.getByLabelText('Startdatum')).toBeTruthy();
    expect(screen.getByLabelText('Startzeit')).toBeTruthy();
  });

  it.each([
    ['a weekday', { weekday: 'Mittwoch' }],
    ['a time note', { timeDescription: 'Einlass ab 18 Uhr' }],
    ['the active output option', { useOnlyTimeDescription: true }],
  ])('opens the extras section initially when it contains %s', (_label, overrides) => {
    renderDates([emptyDate(overrides)]);

    expect(extrasSection().open).toBe(true);
  });

  it('decides the initial state per date', () => {
    renderDates([emptyDate(), emptyDate({ timeDescription: 'Beginn nach Sonnenuntergang' })]);

    expect(extrasSections().map((section) => section.open)).toEqual([false, true]);
  });

  it('lets users open and close the section manually without changing the values', async () => {
    const { form } = renderDates([
      emptyDate({ weekday: 'Mittwoch', useOnlyTimeDescription: true }),
    ]);
    const section = extrasSection();
    const before = form().getValues('content.dates.0');

    toggle(section);
    await waitFor(() => expect(section.open).toBe(false));
    toggle(section);
    await waitFor(() => expect(section.open).toBe(true));

    expect(form().getValues('content.dates.0')).toEqual(before);
    expect(form().formState.isDirty).toBe(false);
  });

  it('keeps a manually opened section open while its values are cleared', async () => {
    renderDates([emptyDate()]);
    const section = extrasSection();

    toggle(section);
    await waitFor(() => expect(section.open).toBe(true));
    const weekday = screen.getByLabelText('Wochentag (optional)');
    fireEvent.change(weekday, { target: { value: 'Montag' } });
    fireEvent.change(weekday, { target: { value: '' } });

    expect(section.open).toBe(true);
  });

  it('recomputes the state when another event is loaded into the mounted form', async () => {
    const { form } = renderDates([emptyDate()]);
    const loadEvent = (date: EventDateValue) => {
      const defaults = createDefaultEventsDetailFormValues();
      // Mirrors useEventsDetailItem: the edit page resets the form without remounting.
      act(() => form().reset({ ...defaults, content: { ...defaults.content, dates: [date] } }));
    };
    expect(extrasSection().open).toBe(false);

    loadEvent(emptyDate({ timeDescription: 'Einlass ab 18 Uhr' }));
    await waitFor(() => expect(extrasSection().open).toBe(true));

    loadEvent(emptyDate());
    await waitFor(() => expect(extrasSection().open).toBe(false));
  });

  it('keeps extras untouched when only the date or time changes', () => {
    const { form } = renderDates([
      emptyDate({
        weekday: 'Mittwoch',
        timeDescription: 'ab 10 Uhr',
        useOnlyTimeDescription: true,
      }),
    ]);

    fireEvent.change(screen.getByLabelText('Startzeit'), { target: { value: '19:00' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-07-01' } });

    expect(form().getValues('content.dates.0')).toMatchObject({
      dateStart: '2026-07-01',
      timeStart: '19:00',
      weekday: 'Mittwoch',
      timeDescription: 'ab 10 Uhr',
      useOnlyTimeDescription: true,
    });
  });

  it('gives each extras toggle a distinct name that identifies its date', () => {
    renderDates([emptyDate(), emptyDate()]);

    expect(
      extrasSections().map((section) => section.querySelector('summary')?.textContent)
    ).toEqual([
      'Weitere Terminangaben (optional) zu Termin 1',
      'Weitere Terminangaben (optional) zu Termin 2',
    ]);
  });

  it('uses the date field id convention for the optional inputs', () => {
    renderDates([emptyDate(), emptyDate()]);

    for (const id of [
      'event-weekday',
      'event-time-description',
      'event-only-time-description',
      'event-weekday-1',
      'event-time-description-1',
      'event-only-time-description-1',
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('links the help texts to the optional inputs', () => {
    renderDates([emptyDate()]);

    const describedText = (label: string) => {
      const ids = screen.getByLabelText(label).getAttribute('aria-describedby') ?? '';
      return ids
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent)
        .join(' ');
    };

    expect(describedText('Wochentag (optional)')).toBe(
      'Bei einem konkreten Datum müssen Sie den Wochentag nicht zusätzlich eintragen.'
    );
    expect(describedText('Hinweis zur Zeit (optional)')).toBe('Zusätzliche Angaben zur Zeit.');
    expect(describedText('Nur den Hinweis zur Zeit anzeigen')).toBe(
      'Verwendet die bestehende Ausgabeoption des Mainservers.'
    );
  });
});
