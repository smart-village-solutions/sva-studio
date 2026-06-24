import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { EventsDetailBasisTab } from '../src/events.detail-basis-tab.js';
import { createDefaultEventsDetailFormValues, type EventsDetailFormValues } from '../src/events.detail-form.js';

const pt = (key: string) =>
  ({
    'cards.basis.identity.title': 'Titel & Kategorie',
    'cards.basis.identity.description': 'Basisdaten',
    'cards.basis.recurrence.title': 'Serien-Logik',
    'cards.basis.recurrence.description': 'Wiederholung',
    'cards.basis.relations.title': 'Verknüpfungen',
    'cards.basis.relations.description': 'Verknüpfungen',
    'fields.title': 'Titel',
    'fields.categories': 'Kategorien',
    'fields.categoriesHelp': 'Mehrfachauswahl',
    'fields.categoriesSearch': 'Kategorien suchen',
    'fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
    'fields.repeat': 'Wiederholung',
    'fields.recurringType': 'Wiederholungstyp',
    'fields.recurringTypePlaceholder': 'Bitte auswählen',
    'fields.recurringTypeOptions.days': 'Tage',
    'fields.recurringTypeOptions.weeks': 'Wochen',
    'fields.recurringTypeOptions.months': 'Monate',
    'fields.recurringTypeOptions.years': 'Jahre',
    'fields.recurringInterval': 'Intervall',
    'fields.recurringWeekdays': 'Wiederholungstage',
    'fields.recurringWeekdayOptions.monday': 'Montag',
    'fields.recurringWeekdayOptions.tuesday': 'Dienstag',
    'fields.recurringWeekdayOptions.wednesday': 'Mittwoch',
    'fields.recurringWeekdayOptions.thursday': 'Donnerstag',
    'fields.recurringWeekdayOptions.friday': 'Freitag',
    'fields.recurringWeekdayOptions.saturday': 'Samstag',
    'fields.recurringWeekdayOptions.sunday': 'Sonntag',
    'fields.recurringWeekdayShortOptions.monday': 'Mo',
    'fields.recurringWeekdayShortOptions.tuesday': 'Di',
    'fields.recurringWeekdayShortOptions.wednesday': 'Mi',
    'fields.recurringWeekdayShortOptions.thursday': 'Do',
    'fields.recurringWeekdayShortOptions.friday': 'Fr',
    'fields.recurringWeekdayShortOptions.saturday': 'Sa',
    'fields.recurringWeekdayShortOptions.sunday': 'So',
    'fields.pointOfInterestId': 'Zugehöriger POI',
    'fields.pointOfInterestSearch': 'POI suchen',
    'fields.pointOfInterestSearchPlaceholder': 'POI suchen oder auswählen',
    'actions.addCategory': 'Kategorie hinzufügen',
    'actions.removeCategory': 'Kategorie {{name}} entfernen',
    'actions.clearPoiSelection': 'Auswahl löschen',
    'messages.categoryOptionsLoading': 'Kategorien werden geladen.',
    'messages.poiOptionsLoading': 'POI werden geladen.',
    'messages.poiOptionsEmpty': 'Keine passenden POI gefunden.',
  })[key] ?? key;

function renderTab(defaultValues?: Partial<EventsDetailFormValues>) {
  const Wrapper = () => {
    const methods = useForm<EventsDetailFormValues>({
      defaultValues: {
        ...createDefaultEventsDetailFormValues(),
        ...defaultValues,
      } as EventsDetailFormValues,
    });

    return (
      <FormProvider {...methods}>
        <EventsDetailBasisTab
          availableCategories={[{ id: 'cat-1', name: 'Kultur' }, { id: 'cat-2', name: 'Open Air' }]}
          availablePois={[{ id: 'poi-1', name: 'Rathaus' }]}
          categoryOptionsLoading={false}
          loadedItem={null}
          mode="create"
          poiOptionsLoading={false}
          pt={pt}
        />
      </FormProvider>
    );
  };

  return render(<Wrapper />);
}

describe('EventsDetailBasisTab', () => {
  it('shows recurrence controls only when repeating is enabled and weekdays only for weeks', () => {
    renderTab();

    expect(screen.queryByLabelText('Wiederholungstyp')).toBeNull();
    expect(screen.queryByLabelText('Intervall')).toBeNull();
    expect(screen.queryByText('Montag')).toBeNull();

    fireEvent.click(screen.getByLabelText('Wiederholung'));

    expect(screen.getByLabelText('Wiederholungstyp')).toBeTruthy();
    expect(screen.getByLabelText('Intervall')).toBeTruthy();
    expect(screen.queryByText('Montag')).toBeNull();

    fireEvent.change(screen.getByLabelText('Wiederholungstyp'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Montag' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sonntag' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Wiederholungstyp'), { target: { value: '2' } });

    expect(screen.queryByRole('button', { name: 'Montag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sonntag' })).toBeNull();
  });
});
