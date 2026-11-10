import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, type FieldErrors, type UseFormReturn } from 'react-hook-form';
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
const pt = (key: string) => translations[key] ?? key;

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

function renderDates(
  dates: readonly EventDateValue[],
  options: { readonly errors?: FieldErrors<EventsDetailFormValues> } = {}
) {
  let form: UseFormReturn<EventsDetailFormValues> | undefined;
  const defaults = createDefaultEventsDetailFormValues();

  const Wrapper = () => {
    const methods = useForm<EventsDetailFormValues>({
      defaultValues: { ...defaults, content: { ...defaults.content, dates: [...dates] } },
      ...(options.errors ? { errors: options.errors } : {}),
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
  Array.from(document.querySelectorAll('details')).filter(
    (element) =>
      element.querySelector('summary')?.textContent === 'Weitere Terminangaben (optional)'
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

  it('opens the extras section initially when it contains an existing validation error', () => {
    renderDates([emptyDate()], {
      errors: {
        content: { dates: [{ weekday: { type: 'manual', message: 'Ungültig' } }] },
      } as FieldErrors<EventsDetailFormValues>,
    });

    expect(extrasSection().open).toBe(true);
  });

  it('opens a collapsed extras section when a validation error appears in it', async () => {
    const { form } = renderDates([emptyDate()]);
    expect(extrasSection().open).toBe(false);

    act(() => {
      form().setError('content.dates.0.timeDescription', { type: 'manual', message: 'Ungültig' });
    });

    await waitFor(() => expect(extrasSection().open).toBe(true));
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

  it('marks the output option as invalid and announces its existing error', () => {
    renderDates([emptyDate()], {
      errors: {
        content: { dates: [{ useOnlyTimeDescription: { type: 'manual', message: 'Ungültig' } }] },
      } as FieldErrors<EventsDetailFormValues>,
    });

    const checkbox = screen.getByLabelText('Nur den Hinweis zur Zeit anzeigen');
    const described = (checkbox.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent);
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(described).toEqual([
      'Verwendet die bestehende Ausgabeoption des Mainservers.',
      'Ungültig',
    ]);
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
