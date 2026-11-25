import React, { useState } from 'react';
import type { WasteLocationTourLinkRecord, WasteTourRecord } from '@sva/waste-management-contracts';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn());
const deleteWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn());
const formatTourRecurrenceMock = vi.hoisted(() => vi.fn(() => 'weekly'));

import { WasteManagementApiError } from '../src/waste-management.api.js';
import { LocationAssignmentsSection } from '../src/waste-management.master-data-location-assignments.js';

vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (key: string, values?: Record<string, string>) =>
    values?.value ? `${key}:${values.value}` : key,
}));

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    createWasteManagementLocationTourLink: createWasteManagementLocationTourLinkMock,
    deleteWasteManagementLocationTourLink: deleteWasteManagementLocationTourLinkMock,
  };
});

vi.mock('../src/waste-management.page.support.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.page.support.js')>();
  return {
    ...actual,
    StatusNotice: ({ message }: { readonly message: { text: string } | null }) =>
      message ? <div>{message.text}</div> : null,
  };
});

vi.mock('../src/waste-management.tours.presentation.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/waste-management.tours.presentation.js')>()),
  formatTourRecurrence: formatTourRecurrenceMock,
}));

vi.mock('../src/waste-management.tours.table-row.parts.js', () => ({
  WasteToursRowFractionCell: ({ fractionNames }: { readonly fractionNames: readonly string[] }) => (
    <td>{fractionNames.join(', ')}</td>
  ),
}));

vi.mock('@sva/studio-ui-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/studio-ui-react')>()),
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Checkbox: ({
    indeterminate,
    ...props
  }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
}));

const prefix = 'masterData.collectionLocations.assignmentEditor';
const existing = { id: 'link-2026', locationId: 'pferdeschwemme', tourId: 'tour-2026' };
const added = { id: 'link-2027', locationId: 'pferdeschwemme', tourId: 'tour-2027' };
const tours = [
  { id: 'tour-2026', name: 'Restmüll 2026', recurrence: 'weekly' },
  { id: 'tour-2027', name: 'Restmüll 2027', recurrence: 'weekly' },
];
const linkRecords = (links: readonly (typeof existing)[]) =>
  links as readonly WasteLocationTourLinkRecord[];

const save = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: `${prefix}.actions.save` });
const reread = () => screen.getByRole('button', { name: `${prefix}.actions.reload` });
const tour = (year: string) =>
  screen.getByRole<HTMLInputElement>('checkbox', {
    name: `tours.table.selectRow:Restmüll ${year}`,
  });

describe('LocationAssignmentsSection', () => {
  const onRead = vi.fn<() => Promise<readonly WasteLocationTourLinkRecord[] | null>>();

  const Harness = ({
    initialLinks = [existing],
  }: {
    initialLinks?: readonly (typeof existing)[];
  }) => {
    const [links, setLinks] = useState(linkRecords(initialLinks));
    return (
      <>
        <button type="button" onClick={() => setLinks([...links])}>
          Reload equivalent links
        </button>
        <LocationAssignmentsSection
          locationId="pferdeschwemme"
          tours={tours as never}
          fractions={[]}
          links={links}
          onReload={async () => {
            const result = await onRead();
            if (result) setLinks(result);
            return result;
          }}
        />
      </>
    );
  };

  beforeEach(() => {
    vi.resetAllMocks();
    formatTourRecurrenceMock.mockReturnValue('weekly');
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => added.id) });
    createWasteManagementLocationTourLinkMock.mockResolvedValue(added);
    deleteWasteManagementLocationTourLinkMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('describes the validity on same-name tour selections without changing their IDs', () => {
    const sameNameTours = [
      { id: existing.tourId, name: 'Restmüll', firstDate: '2026-02-01', endDate: '2026-12-31' },
      { id: added.tourId, name: 'Restmüll', firstDate: '2027-02-01' },
      { id: 'custom', name: 'Restmüll', recurrence: 'custom' },
    ] satisfies readonly Partial<WasteTourRecord>[];
    render(
      <LocationAssignmentsSection
        locationId={existing.locationId}
        tours={sameNameTours as readonly WasteTourRecord[]}
        fractions={[]}
        links={linkRecords([existing])}
        onReload={onRead}
      />
    );
    const byPeriod = (description: string) =>
      screen.getByRole<HTMLInputElement>('checkbox', {
        name: 'tours.table.selectRow:Restmüll',
        description,
      });
    expect(byPeriod('01.02.2026 – 31.12.2026').checked).toBe(true);
    expect(byPeriod('tours.fields.firstDate 01.02.2027').checked).toBe(false);
    expect(byPeriod('tours.fields.customDates').checked).toBe(false);
    const nextTour = byPeriod('tours.fields.firstDate 01.02.2027');
    const row = nextTour.closest('tr');
    if (!row) throw new Error('Tour row is missing');
    const rowIndex = screen.getAllByRole('row').indexOf(row);
    fireEvent.click(within(row).getByText('Restmüll'));
    expect(screen.getAllByRole('row')[rowIndex]).toBe(row);
    expect(document.activeElement).toBe(nextTour);
    expect(byPeriod('01.02.2026 – 31.12.2026').checked).toBe(true);
    expect(byPeriod('tours.fields.firstDate 01.02.2027').checked).toBe(true);
  });

  it('filters by overlapping validity years and lets explicit sorting override assigned-first order', () => {
    vi.setSystemTime(new Date('2026-11-23T11:00:00Z'));
    const entries = [
      { id: 'early', name: 'A-Tour', firstDate: '2026-01-15', endDate: '2026-12-31' },
      { id: 'later', name: 'B-Tour', firstDate: '2027-01-16', endDate: '2027-12-31' },
      { id: existing.tourId, name: 'Z-Tour', firstDate: '2026-12-20', endDate: '2027-01-15' },
    ];
    render(
      <LocationAssignmentsSection
        locationId={existing.locationId}
        tours={entries as readonly WasteTourRecord[]}
        fractions={[]}
        links={linkRecords([existing])}
        onReload={onRead}
      />
    );
    const rowNames = () =>
      within(screen.getByRole('table')).getAllByRole('row').slice(1).map(
        (row) => row.querySelector('input')?.getAttribute('aria-label')
      );
    const names = (...labels: string[]) => labels.map((name) => `tours.table.selectRow:${name}`);
    const year = screen.getByRole('combobox', { name: 'tours.filters.validityPeriodLabel' });
    expect(rowNames()).toEqual(names('Z-Tour', 'A-Tour', 'B-Tour'));
    fireEvent.change(year, { target: { value: 'current' } });
    expect(rowNames()).toEqual(names('Z-Tour', 'A-Tour'));
    fireEvent.change(year, { target: { value: 'next' } });
    expect(rowNames()).toEqual(names('Z-Tour', 'B-Tour'));

    const nameSort = screen.getByRole('button', { name: 'tours.table.name' });
    fireEvent.click(nameSort);
    expect(rowNames()).toEqual(names('B-Tour', 'Z-Tour'));
    fireEvent.click(nameSort);
    expect(rowNames()).toEqual(names('Z-Tour', 'B-Tour'));
  });

  it('saves all filtered tours across pages and retains a draft selection outside the filter', async () => {
    const entries = Array.from({ length: 22 }, (_, index) => ({
      id: `test-tour-${index}`,
      name: index === 21 ? 'Bioabfall' : `Restmüll ${index + 1}`,
      recurrence: 'weekly',
    }));
    const links = entries.map(({ id }) => ({
      id: `link-${id}`,
      locationId: existing.locationId,
      tourId: id,
    }));
    createWasteManagementLocationTourLinkMock.mockImplementation(async ({ tourId }) =>
      links.find((link) => link.tourId === tourId)
    );
    onRead.mockResolvedValueOnce(linkRecords(links));
    render(
      <LocationAssignmentsSection
        locationId={existing.locationId}
        tours={entries as readonly WasteTourRecord[]}
        fractions={[]}
        links={[]}
        onReload={onRead}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'tours.table.selectRow:Bioabfall' }));
    const table = screen.getByRole('table');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Restmüll' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'meta.pagination.pageSizeLabel' }), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.table.name' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.table.name' }));
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(tour('21')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'meta.pagination.next' }));
    expect(tour('11')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'tours.table.selectRow:Restmüll 21' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: `${prefix}.actions.selectAllFiltered` }));
    expect(tour('11').checked).toBe(true);
    fireEvent.click(save());

    expect(await screen.findByText(`${prefix}.messages.saveSuccess`)).toBeTruthy();
    expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledTimes(22);
    expect(
      createWasteManagementLocationTourLinkMock.mock.calls.map(([input]) => input.tourId)
    ).toEqual(expect.arrayContaining(entries.map((entry) => entry.id)));
    expect(deleteWasteManagementLocationTourLinkMock).not.toHaveBeenCalled();
  });

  it('keeps the 2027 draft on an equivalent reload and confirms one link after save and reopen', async () => {
    onRead.mockResolvedValueOnce(linkRecords([existing, added]));
    const view = render(<Harness />);
    fireEvent.click(tour('2027'));
    fireEvent.click(screen.getByRole('button', { name: 'Reload equivalent links' }));
    expect(tour('2027').checked).toBe(true);
    fireEvent.click(save());

    expect(await screen.findByText(`${prefix}.messages.saveSuccess`)).toBeTruthy();
    expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledExactlyOnceWith({
      id: added.id,
      locationId: added.locationId,
      tourId: added.tourId,
    });
    view.unmount();
    render(<Harness initialLinks={[existing, added]} />);
    expect(tour('2027').checked).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it('does not write or show success for an unchanged selection', () => {
    render(<Harness />);
    fireEvent.click(save());
    expect(createWasteManagementLocationTourLinkMock).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();
    expect(screen.queryByText(`${prefix}.messages.saveSuccess`)).toBeNull();
  });

  it.each(['failed GET', 'GET missing the write'])(
    'only reads again after a %s',
    async (scenario) => {
      if (scenario === 'failed GET') onRead.mockRejectedValueOnce(new Error('read failed'));
      else onRead.mockResolvedValueOnce(linkRecords([existing]));
      onRead.mockResolvedValueOnce(linkRecords([existing, added]));
      render(<Harness />);
      fireEvent.click(tour('2027'));
      fireEvent.click(save());

      expect(await screen.findByText(`${prefix}.messages.readBackUnconfirmed`)).toBeTruthy();
      expect(screen.queryByText(`${prefix}.messages.saveSuccess`)).toBeNull();
      expect(tour('2027').checked).toBe(true);
      fireEvent.click(reread());

      expect(await screen.findByText(`${prefix}.messages.saveSuccess`)).toBeTruthy();
      expect(onRead).toHaveBeenCalledTimes(2);
      expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledOnce();
    }
  );

  it('waits for all writes, shows a partial result and retries only the outstanding deletion', async () => {
    const addResponse = Promise.withResolvers<typeof added>();
    createWasteManagementLocationTourLinkMock.mockReturnValueOnce(addResponse.promise);
    deleteWasteManagementLocationTourLinkMock.mockRejectedValueOnce(new Error('delete failed'));
    onRead
      .mockResolvedValueOnce(linkRecords([existing, added]))
      .mockResolvedValueOnce(linkRecords([added]));
    render(<Harness />);
    fireEvent.click(tour('2026'));
    fireEvent.click(tour('2027'));
    fireEvent.click(save());
    expect(onRead).not.toHaveBeenCalled();
    await act(async () => addResponse.resolve(added));

    expect(await screen.findByText(`${prefix}.messages.savePartial:1`)).toBeTruthy();
    expect(screen.getByText(`${prefix}.meta.removalPending`)).toBeTruthy();
    expect(screen.queryByText(`${prefix}.meta.additionPending`)).toBeNull();
    fireEvent.click(save());

    expect(await screen.findByText(`${prefix}.messages.saveSuccess`)).toBeTruthy();
    expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledOnce();
    expect(deleteWasteManagementLocationTourLinkMock).toHaveBeenCalledTimes(2);
    expect(deleteWasteManagementLocationTourLinkMock).toHaveBeenLastCalledWith(existing.id);
  });

  it('reports rejected writes after reading the current links', async () => {
    createWasteManagementLocationTourLinkMock.mockRejectedValueOnce(
      new WasteManagementApiError('forbidden')
    );
    onRead.mockResolvedValueOnce(linkRecords([existing]));
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: `${prefix}.actions.selectAllFiltered` }));
    fireEvent.click(save());

    await waitFor(() => expect(onRead).toHaveBeenCalledOnce());
    expect(await screen.findByText(`${prefix}.messages.saveForbidden`)).toBeTruthy();
    expect(tour('2027').checked).toBe(true);
  });
});
