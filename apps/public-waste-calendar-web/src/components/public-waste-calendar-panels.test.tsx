// @vitest-environment jsdom

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
        onActivateEntry={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: 'In Kalender übernehmen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Druckversion herunterladen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'PDF 2026' })).toBeNull();
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
        onActivateEntry={onActivateEntry}
      />
    );

    expect(screen.getByRole('tab', { name: 'Liste' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Monat' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Jahr' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Monat' }));

    expect(screen.getByRole('heading', { name: 'Mai 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 19.05.2026' }));
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
        onActivateEntry={vi.fn()}
      />
    );

    const listTab = screen.getByRole('tab', { name: 'Liste' });
    listTab.focus();
    fireEvent.keyDown(listTab, { key: 'ArrowRight' });
    const monthTab = screen.getByRole('tab', { name: 'Monat' });
    expect(monthTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(monthTab);

    fireEvent.keyDown(monthTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Liste' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(listTab);

    fireEvent.keyDown(listTab, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Jahr' }));
  });

  it('renders upcoming entries as static content before a separate past section', () => {
    const onActivateEntry = vi.fn();
    const { container } = render(
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
              tourDescription:
                '<p><strong>Bereitstellung:</strong> am Vorabend.</p><script>window.alert("xss")</script>',
              note:
                '<p>Terminbezogener Hinweis.</p><a href="javascript:alert(1)">Unsicherer Link</a>',
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
        onActivateEntry={onActivateEntry}
      />
    );

    expect(screen.queryByRole('button', { name: /Termin .* am \d{2}\.05\.2026/ })).toBeNull();
    expect(screen.getByText('Bereitstellung:').tagName).toBe('STRONG');
    expect(screen.getByText('Terminbezogener Hinweis.')).toBeTruthy();
    expect(screen.getByText('Unsicherer Link').getAttribute('href')).toBeNull();
    expect(container.querySelector('.pickup-description script')).toBeNull();
    expect(container.textContent).not.toContain('window.alert');
    expect(onActivateEntry).not.toHaveBeenCalled();
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

  it('reports the month calendar year after navigating across New Year', () => {
    const onVisibleYearChange = vi.fn();

    render(
      <PublicWasteCalendarPanels
        model={createFilteredPublicWasteCalendarModelFixture({
          listEntries: [createPublicWasteCalendarEntryFixture()],
        })}
        onActivateEntry={vi.fn()}
        onVisibleYearChange={onVisibleYearChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Monat' }));
    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    }

    expect(screen.getByRole('heading', { name: 'Januar 2027' })).toBeTruthy();
    expect(onVisibleYearChange).toHaveBeenLastCalledWith(2027);
  });
});
