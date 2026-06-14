import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollectionLocationFormState } from '../src/waste-management.master-data.forms.js';
import {
  createLocationBulkAssignmentsHandler,
  createLocationDeleteHandler,
  createLocationSubmitHandler,
} from '../src/waste-management.master-data.location-mutation.helpers.js';
import { createToursAssignmentSubmitHandler } from '../src/waste-management.tours.assignment-mutation.helpers.js';

const createWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const createWasteManagementLocationTourLinksBulkMock = vi.hoisted(() => vi.fn(async () => undefined));
const createWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementLocationTourLinkMock = vi.hoisted(() => vi.fn(async () => undefined));
const submitWasteLocationTourLinksBulkInChunksMock = vi.hoisted(() => vi.fn(async () => undefined));
const applySuccessMock = vi.hoisted(() => vi.fn((close, setMessage, message, setOutcome) => {
  close();
  setMessage({ kind: 'success', text: message });
  setOutcome();
}));

vi.mock('../src/waste-management.api.js', () => ({
  WasteManagementApiError: class WasteManagementApiError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  createWasteManagementCollectionLocation: (...args: Parameters<typeof createWasteManagementCollectionLocationMock>) =>
    createWasteManagementCollectionLocationMock(...args),
  updateWasteManagementCollectionLocation: (...args: Parameters<typeof updateWasteManagementCollectionLocationMock>) =>
    updateWasteManagementCollectionLocationMock(...args),
  deleteWasteManagementCollectionLocation: (...args: Parameters<typeof deleteWasteManagementCollectionLocationMock>) =>
    deleteWasteManagementCollectionLocationMock(...args),
  createWasteManagementLocationTourLinksBulk: (...args: Parameters<typeof createWasteManagementLocationTourLinksBulkMock>) =>
    createWasteManagementLocationTourLinksBulkMock(...args),
  createWasteManagementLocationTourLink: (...args: Parameters<typeof createWasteManagementLocationTourLinkMock>) =>
    createWasteManagementLocationTourLinkMock(...args),
  deleteWasteManagementLocationTourLink: (...args: Parameters<typeof deleteWasteManagementLocationTourLinkMock>) =>
    deleteWasteManagementLocationTourLinkMock(...args),
  updateWasteManagementLocationTourLink: (...args: Parameters<typeof updateWasteManagementLocationTourLinkMock>) =>
    updateWasteManagementLocationTourLinkMock(...args),
}));

vi.mock('../src/waste-management.location-tour-links-bulk-client.js', () => ({
  submitWasteLocationTourLinksBulkInChunks: (
    ...args: Parameters<typeof submitWasteLocationTourLinksBulkInChunksMock>
  ) => submitWasteLocationTourLinksBulkInChunksMock(...args),
}));

vi.mock('../src/use-waste-master-data-state.js', () => ({
  applySuccess: (...args: Parameters<typeof applySuccessMock>) => applySuccessMock(...args),
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  resolveApiErrorCode: (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code ?? null : null,
}));

const createLocationState = () => ({
  bulkAssignmentsForm: {
    tourId: 'tour-1',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  },
  locationDialogMode: 'create' as const,
  setSaving: vi.fn(),
  setMessage: vi.fn(),
  setLastOutcome: vi.fn(),
  setLocationDialogOpen: vi.fn(),
  setSelectedLocationIds: vi.fn(),
  setBulkAssignmentsDialogOpen: vi.fn(),
});

const createLocationForm = (): CollectionLocationFormState => ({
  id: 'location-1',
  regionId: 'region-1',
  cityId: 'city-1',
  streetId: 'street-1',
  houseNumberId: 'house-1',
  active: true,
});

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) =>
  variables ? `${key}:${JSON.stringify(variables)}` : key;

describe('waste-management mutation helper logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits a new location, reloads overview and applies success state', async () => {
    const state = createLocationState();
    const loadOverview = vi.fn(async () => undefined);
    const handler = createLocationSubmitHandler({
      state: state as never,
      pt,
      search: { locationsView: 'list' } as never,
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handler(createLocationForm());

    expect(createWasteManagementCollectionLocationMock).toHaveBeenCalledOnce();
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(applySuccessMock).toHaveBeenCalledOnce();
    expect(state.setLocationDialogOpen).toHaveBeenCalledWith(false);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'masterData.collectionLocations.messages.createSuccess',
    });
    expect(state.setLastOutcome).toHaveBeenCalledWith('location-create-success');
  });

  it('maps delete conflicts to the singular delete error message', async () => {
    const state = createLocationState();
    const loadOverview = vi.fn(async () => undefined);
    deleteWasteManagementCollectionLocationMock.mockRejectedValueOnce({ code: 'conflict' });
    const handler = createLocationDeleteHandler({
      state: state as never,
      pt,
      search: { locationsView: 'list' } as never,
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handler({ id: 'location-9' });

    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.messages.deleteConflict',
    });
  });

  it('maps forbidden bulk assignment errors to the dedicated bulk message', async () => {
    const state = createLocationState();
    const loadOverview = vi.fn(async () => undefined);
    submitWasteLocationTourLinksBulkInChunksMock.mockRejectedValueOnce({ code: 'forbidden' });
    const handler = createLocationBulkAssignmentsHandler({
      state: state as never,
      pt,
      search: { locationsView: 'list' } as never,
      loadOverview,
      selectedCollectionLocationIds: ['location-1', 'location-2'],
    });

    await handler({ preventDefault: vi.fn() } as never);

    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.bulk.messages.assignForbidden',
    });
  });

  it('updates assignment sets in edit mode via bulk create, delete and update operations', async () => {
    const state = {
      assignmentsDialogMode: 'edit' as const,
      selectedTour: { id: 'tour-1' },
      linkForm: {
        id: 'link-2',
        locationId: 'location-2',
        tourId: 'tour-1',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      },
      masterDataOverview: {
        locationTourLinks: [
          { id: 'link-1', locationId: 'location-1', tourId: 'tour-1' },
          { id: 'link-2', locationId: 'location-2', tourId: 'tour-1' },
        ],
      },
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setAssignmentsDialogOpen: vi.fn(),
    };
    const loadOverview = vi.fn(async () => undefined);
    const handler = createToursAssignmentSubmitHandler({
      state: state as never,
      pt,
      loadOverview,
    });

    await handler({ preventDefault: vi.fn() } as never, ['location-2', 'location-3']);

    expect(submitWasteLocationTourLinksBulkInChunksMock).toHaveBeenCalledOnce();
    expect(deleteWasteManagementLocationTourLinkMock).toHaveBeenCalledWith('link-1');
    expect(updateWasteManagementLocationTourLinkMock).not.toHaveBeenCalled();
    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'success',
      text: 'tours.assignments.messages.updateSuccess',
    });
  });

});
