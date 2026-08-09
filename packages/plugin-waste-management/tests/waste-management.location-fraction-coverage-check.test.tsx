import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteLocationFractionCoverageCheck } from '../src/waste-management.location-fraction-coverage-check.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const timestamp = '2026-08-09T10:00:00.000Z';
const locations = [
  { id: 'missing', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'partial', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'covered', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'inactive', cityId: 'city-1', active: false, createdAt: timestamp, updatedAt: timestamp },
];
const fractions = [
  {
    id: 'paper',
    name: 'Papier, Pappe, Kartonagen',
    color: '#000000',
    active: true,
    reminderConfig: { enabled: false, channels: [], slots: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const tours = [
  {
    id: 'partial-paper-tour',
    name: 'Papiertour erstes Halbjahr',
    wasteFractionIds: ['paper'],
    firstDate: '2027-01-01',
    endDate: '2027-06-30',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'covered-paper-tour',
    name: 'Papiertour ganzjährig',
    wasteFractionIds: ['paper'],
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const links = [
  {
    id: 'partial-link',
    locationId: 'partial',
    tourId: 'partial-paper-tour',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'covered-link',
    locationId: 'covered',
    tourId: 'covered-paper-tour',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

afterEach(() => cleanup());

describe('WasteLocationFractionCoverageCheck', () => {
  it('shows missing and incomplete assignments separately and opens bulk assignment for all issues', () => {
    const onReplaceLocationSelection = vi.fn();
    const onOpenBulkAssignments = vi.fn();

    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        tours={tours}
        links={links}
        onReplaceLocationSelection={onReplaceLocationSelection}
        onOpenBulkAssignments={onOpenBulkAssignments}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => `Ort ${location.id}`}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' }));

    expect(screen.getByText('masterData.locationsWorkspace.coverage.missing')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.coverage.incomplete')).toBeTruthy();
    expect(screen.getByText('Ort missing')).toBeTruthy();
    expect(screen.getByText('Ort partial')).toBeTruthy();
    expect(screen.queryByText('Ort covered')).toBeNull();
    expect(screen.queryByText('Ort inactive')).toBeNull();
    expect(
      screen.getByText(
        'masterData.locationsWorkspace.coverage.gap:{"startDate":"01.07.2027","endDate":"31.12.2027"}'
      )
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'masterData.locationsWorkspace.coverage.selectAndAssign:{"value":2}',
      })
    );

    expect(onReplaceLocationSelection).toHaveBeenCalledWith(['missing', 'partial']);
    expect(onReplaceLocationSelection).toHaveBeenCalledTimes(1);
    expect(onOpenBulkAssignments).toHaveBeenCalledTimes(1);
  });

  it('rejects an end date before the start date without running the check', () => {
    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        tours={tours}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'masterData.locationsWorkspace.coverage.invalidDateRange'
    );
    expect(screen.queryByText('Ort missing')).toBeNull();
  });
});
