import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';

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
        model={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [],
          monthBuckets: [],
          yearBuckets: [],
          activeFractionIds: ['bio'],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall', color: '#00AA00' }],
        }}
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
        model={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [],
          monthBuckets: [],
          yearBuckets: [],
          activeFractionIds: ['bio', 'paper'],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'paper', label: 'Papier', color: '#0000FF' },
          ],
        }}
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
        model={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [
            {
              id: 'pickup-1',
              date: '2026-05-19',
              fractionId: 'bio',
              fractionLabel: 'Bioabfall',
              fractionColor: '#00AA00',
              note: null,
            },
            {
              id: 'pickup-2',
              date: '2026-06-02',
              fractionId: 'paper',
              fractionLabel: 'Papier',
              fractionColor: '#0000FF',
              note: null,
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          activeFractionIds: ['bio', 'paper'],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
            { id: 'paper', label: 'Papier', color: '#0000FF' },
          ],
        }}
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
        model={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [],
          monthBuckets: [],
          yearBuckets: [],
          activeFractionIds: ['bio'],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall', color: '#00AA00' }],
        }}
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
});
