import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { EventsDetailBasisTab } from '../src/events.detail-basis-tab.js';
import {
  createDefaultEventsDetailFormValues,
  type EventsDetailFormValues,
} from '../src/events.detail-form.js';

const pt = (key: string) =>
  ({
    'cards.basis.identity.title': 'Titel & Kategorie',
    'cards.basis.identity.description': 'Basisdaten',
    'cards.basis.recurrence.title': 'Serien-Logik',
    'cards.basis.recurrence.description': 'Wiederholung',
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
    'actions.addCategory': 'Kategorie hinzufügen',
    'actions.removeCategory': 'Kategorie {{name}} entfernen',
    'messages.categoryOptionsLoading': 'Kategorien werden geladen.',
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
          availableCategories={[
            { id: 'cat-1', name: 'Kultur' },
            { id: 'cat-2', name: 'Open Air' },
          ]}
          categoryOptionsLoading={false}
          loadedItem={null}
          mode="create"
          pt={pt}
        />
      </FormProvider>
    );
  };

  return render(<Wrapper />);
}

describe('EventsDetailBasisTab', () => {
  it('updates form categories when clicking the name and the free row area', () => {
    renderTab();
    const trigger = screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' });
    expect(trigger.id).toBe('event-category');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Kultur'));
    expect(screen.getByRole('button', { name: 'Kultur' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Kultur' }) as HTMLInputElement).checked).toBe(
      true
    );

    const row = screen.getByText('Open Air').closest('label');
    if (!row) throw new Error('Category row is missing');
    fireEvent.click(row);
    expect(screen.getByRole('button', { name: 'Kultur, Open Air' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Open Air' }) as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kultur' }));
    expect(screen.getByRole('button', { name: 'Open Air' })).toBeTruthy();
  });

  it('does not render the removed POI relation fields', () => {
    renderTab();

    expect(screen.queryByText('Verknüpfungen')).toBeNull();
    expect(screen.queryByLabelText('Zugehöriger POI')).toBeNull();
  });

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
