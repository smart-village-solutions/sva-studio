import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn());
const deleteWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn());
const formatTourRecurrenceMock = vi.hoisted(() => vi.fn(() => 'weekly'));

import { WasteManagementApiError } from '../src/waste-management.api.js';
import { LocationAssignmentsSection } from '../src/waste-management.master-data-location-assignments.js';

vi.mock('@sva/plugin-sdk', () => ({
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
    StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
  };
});

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  formatTourRecurrence: formatTourRecurrenceMock,
}));

vi.mock('../src/waste-management.tours.table-row.parts.js', () => ({
  WasteToursRowFractionCell: ({ fractionNames }: { readonly fractionNames: readonly string[] }) => (
    <td>{fractionNames.join(', ')}</td>
  ),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Checkbox: ({ indeterminate, ...props }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
}));

describe('LocationAssignmentsSection', () => {
  const onReload = vi.fn(async () => undefined);

  const fractions = [
    { id: 'fraction-1', name: 'Restmuell' },
    { id: 'fraction-2', name: 'Bio' },
  ] as const;

  const tours = [
    {
      id: 'tour-2',
      name: 'Bio Route',
      fractionIds: ['fraction-2'],
      recurrence: 'biweekly',
    },
    {
      id: 'tour-1',
      name: 'Rest Route',
      fractionIds: ['fraction-1'],
      recurrence: 'weekly',
    },
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-link-id') });
  });

  afterEach(() => {
    cleanup();
  });

  it('persists created and deleted tour assignments for the current location', async () => {
    createWasteManagementLocationTourLinkMock.mockResolvedValueOnce(undefined);
    deleteWasteManagementLocationTourLinkMock.mockResolvedValueOnce(undefined);

    render(
      <LocationAssignmentsSection
        locationId="location-1"
        tours={tours as never}
        fractions={fractions as never}
        links={[{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1' }] as never}
        onReload={onReload}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'tours.table.selectRow:Bio Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.assignmentEditor.actions.save' }));

    await waitFor(() => {
      expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledWith({
        id: 'generated-link-id',
        locationId: 'location-1',
        tourId: 'tour-2',
        startDate: undefined,
        endDate: undefined,
      });
    });
    expect(deleteWasteManagementLocationTourLinkMock).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledWith();
    expect(screen.getByText('masterData.collectionLocations.assignmentEditor.messages.saveSuccess')).toBeTruthy();
  });

  it('removes deselected links and keeps save local when nothing changed', async () => {
    deleteWasteManagementLocationTourLinkMock.mockResolvedValueOnce(undefined);

    const { rerender } = render(
      <LocationAssignmentsSection
        locationId="location-1"
        tours={tours as never}
        fractions={fractions as never}
        links={[{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1' }] as never}
        onReload={onReload}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'tours.table.selectRow:Rest Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.assignmentEditor.actions.save' }));

    await waitFor(() => {
      expect(deleteWasteManagementLocationTourLinkMock).toHaveBeenCalledWith('link-1');
    });
    expect(onReload).toHaveBeenCalledWith();

    rerender(
      <LocationAssignmentsSection
        locationId="location-1"
        tours={tours as never}
        fractions={fractions as never}
        links={[{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1' }] as never}
        onReload={onReload}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.assignmentEditor.actions.save' }));

    await waitFor(() => {
      expect(screen.getByText('masterData.collectionLocations.assignmentEditor.messages.saveSuccess')).toBeTruthy();
    });
    expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledTimes(0);
  });

  it('surfaces forbidden save failures and supports selecting all visible tours', async () => {
    createWasteManagementLocationTourLinkMock.mockRejectedValueOnce(
      new WasteManagementApiError('forbidden', 'Nicht erlaubt')
    );

    render(
      <LocationAssignmentsSection
        locationId="location-1"
        tours={tours as never}
        fractions={fractions as never}
        links={[] as never}
        onReload={onReload}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'tours.table.selectAll' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.assignmentEditor.actions.save' }));

    await waitFor(() => {
      expect(createWasteManagementLocationTourLinkMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('masterData.collectionLocations.assignmentEditor.messages.saveForbidden')).toBeTruthy();
  });
});
