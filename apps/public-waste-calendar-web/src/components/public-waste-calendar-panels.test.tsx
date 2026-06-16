import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';
import {
  createFilteredPublicWasteCalendarModelFixture,
  createPublicWasteCalendarEntryFixture,
} from './public-waste-test-fixtures.js';

describe('PublicWasteCalendarPanels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render export actions inside the calendar panel', () => {
    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall', color: '#00AA00' }],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: 'In Kalender übernehmen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Druckversion herunterladen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'PDF 2026' })).toBeNull();
  });

  it('renders fraction badges with the configured fraction background colors', () => {
    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [],
          activeFractionIds: ['bio', 'paper'],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'paper', label: 'Papier', color: '#0000FF' },
          ],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={vi.fn()}
      />
    );

    expect(screen.getByText('Bioabfall').closest('label')?.getAttribute('style')).toContain(
      'background-color: #00AA00'
    );
    expect(screen.getByText('Papier').closest('label')?.getAttribute('style')).toContain(
      'background-color: #0000FF'
    );
  });

  it('renders three tabs and allows switching to the month and year calendar views', () => {
    const onActivateEntry = vi.fn();

    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [
            createPublicWasteCalendarEntryFixture(),
            createPublicWasteCalendarEntryFixture({
              id: 'pickup-2',
              date: '2026-06-02',
              fractionId: 'paper',
              fractionLabel: 'Papier',
              fractionColor: '#0000FF',
            }),
          ],
          activeFractionIds: ['bio', 'paper'],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'paper', label: 'Papier', color: '#0000FF' },
          ],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={onActivateEntry}
      />
    );

    expect(screen.getByRole('tab', { name: 'Liste' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Monat' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Jahr' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Monat' }));

    expect(screen.getByRole('heading', { name: 'Mai 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }));
    expect(onActivateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pickup-1',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    expect(screen.getByRole('heading', { name: 'Juni 2026' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Jahr' }));
    expect(screen.getByRole('heading', { name: '2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Jahr' }));
    expect(screen.getByRole('heading', { name: '2027' })).toBeTruthy();
  });

  it('supports keyboard navigation between tabs', () => {
    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall', color: '#00AA00' }],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={vi.fn()}
      />
    );

    const listTab = screen.getByRole('tab', { name: 'Liste' });
    fireEvent.keyDown(listTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Monat' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Monat' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Liste' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders upcoming entries before a separate past section in the list view', () => {
    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          nextPickupDate: '2026-05-19',
          listEntries: [
            createPublicWasteCalendarEntryFixture({
              id: 'pickup-past',
              date: '2026-05-12',
              fractionLabel: 'Restmüll',
              fractionId: 'rest',
              fractionColor: '#444444',
            }),
            createPublicWasteCalendarEntryFixture({
              id: 'pickup-next',
              date: '2026-05-19',
              fractionLabel: 'Bioabfall',
            }),
            createPublicWasteCalendarEntryFixture({
              id: 'pickup-future',
              date: '2026-05-21',
              fractionLabel: 'Papier',
              fractionId: 'paper',
              fractionColor: '#0000FF',
            }),
          ],
          activeFractionIds: ['rest', 'bio', 'paper'],
          fractionOptions: [
            { id: 'rest', label: 'Restmüll', color: '#444444' },
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'paper', label: 'Papier', color: '#0000FF' },
          ],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button', { name: /Termin .* am 2026-05-/ });
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Termin Bioabfall am 2026-05-19',
      'Termin Papier am 2026-05-21',
      'Termin Restmüll am 2026-05-12',
    ]);
    expect(screen.getByRole('heading', { name: 'Vergangene Termine' })).toBeTruthy();
  });

  it('allows month navigation back to the earliest available month in the previous year', () => {
    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [
            createPublicWasteCalendarEntryFixture({
              id: 'pickup-oldest',
              date: '2025-01-15',
            }),
            createPublicWasteCalendarEntryFixture(),
          ],
        })}
        onToggleFraction={vi.fn()}
        onActivateEntry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Monat' }));

    const previousMonthButton = screen.getByRole('button', { name: 'Vorheriger Monat' });
    for (let index = 0; index < 16; index += 1) {
      fireEvent.click(previousMonthButton);
    }

    expect(screen.getByRole('heading', { name: 'Januar 2025' })).toBeTruthy();
    expect(previousMonthButton.getAttribute('disabled')).not.toBeNull();
  });
});
