import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './ui/button';
import { StudioDataTable, type StudioColumnDef } from './StudioDataTable';

type DemoRow = {
  id: string;
  region: string;
  city: string;
};

const demoColumns: readonly StudioColumnDef<DemoRow>[] = [
  {
    id: 'region',
    header: 'Region',
    cell: (row) => row.region,
    sortable: true,
    sortValue: (row) => row.region,
  },
  {
    id: 'city',
    header: 'Ort',
    cell: (row) => row.city,
    sortable: true,
    sortValue: (row) => row.city,
  },
];

describe('StudioDataTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('sorts columns and renders actions column at the end', () => {
    render(
      <StudioDataTable
        ariaLabel="Abholorte"
        caption="Tabelle der Abholorte"
        data={[
          { id: '2', region: 'Prignitz', city: 'Pritzwalk' },
          { id: '1', region: 'Barnim', city: 'Bernau' },
        ]}
        columns={demoColumns}
        emptyState={<div>leer</div>}
        getRowId={(row) => row.id}
        rowActions={(row) => <Button type="button">{`Bearbeiten ${row.city}`}</Button>}
      />
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers.at(-1)?.textContent).toContain('Aktionen');

    fireEvent.click(screen.getByRole('button', { name: /Region/i }));
    let rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Barnim');

    fireEvent.click(screen.getByRole('button', { name: /Region/i }));
    rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Prignitz');
  });

  it('supports row selection and bulk actions', () => {
    const bulkAction = vi.fn();

    render(
      <StudioDataTable
        ariaLabel="Abholorte"
        data={[
          { id: '1', region: 'Prignitz', city: 'Perleberg' },
          { id: '2', region: 'Barnim', city: 'Bernau' },
        ]}
        columns={demoColumns}
        emptyState={<div>leer</div>}
        getRowId={(row) => row.id}
        bulkActions={[
          {
            id: 'delete',
            label: 'Löschen',
            variant: 'destructive',
            onClick: ({ selectedRows }) => bulkAction(selectedRows),
          },
        ]}
      />
    );

    const rowCheckbox = screen.getByLabelText('Abholorte: Zeile 1 auswählen');
    fireEvent.click(rowCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(bulkAction).toHaveBeenCalledWith([
      { id: '1', region: 'Prignitz', city: 'Perleberg' },
    ]);
  });

  it('renders empty and loading states', () => {
    const { rerender } = render(
      <StudioDataTable
        ariaLabel="Abholorte"
        data={[]}
        columns={demoColumns}
        emptyState={<div>Keine Daten</div>}
        getRowId={(row) => row.id}
      />
    );

    expect(screen.getByText('Keine Daten')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();

    rerender(
      <StudioDataTable
        ariaLabel="Abholorte"
        data={[]}
        columns={demoColumns}
        emptyState={<div>Keine Daten</div>}
        loadingState={<div>Lädt</div>}
        isLoading
        getRowId={(row) => row.id}
      />
    );

    expect(screen.getByText('Lädt')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders mobile card content with labels', () => {
    render(
      <StudioDataTable
        ariaLabel="Abholorte"
        data={[{ id: '1', region: 'Prignitz', city: 'Perleberg' }]}
        columns={demoColumns}
        emptyState={<div>leer</div>}
        getRowId={(row) => row.id}
      />
    );

    const cards = screen.getAllByText('Region');
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Perleberg').length).toBeGreaterThan(0);
  });
});
