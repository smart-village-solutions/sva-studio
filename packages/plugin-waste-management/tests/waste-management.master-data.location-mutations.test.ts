import { describe, expect, it, vi } from 'vitest';

const createWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const createWasteManagementLocationTourLinksBulkMock = vi.hoisted(() => vi.fn(async () => undefined));

import { createWasteMasterDataLocationMutations } from '../src/waste-management.master-data.location-mutations.js';
import { WasteManagementApiError } from '../src/waste-management.api.js';

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    createWasteManagementCollectionLocation: createWasteManagementCollectionLocationMock,
    createWasteManagementLocationTourLinksBulk: createWasteManagementLocationTourLinksBulkMock,
    deleteWasteManagementCollectionLocation: deleteWasteManagementCollectionLocationMock,
    updateWasteManagementCollectionLocation: updateWasteManagementCollectionLocationMock,
  };
});

describe('createWasteMasterDataLocationMutations', () => {
  const createState = () =>
    ({
      locationForm: {
        id: 'location-1',
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        active: true,
      },
      bulkAssignmentsForm: {
        tourId: 'tour-1',
        startDate: '',
        endDate: '',
      },
      locationDialogMode: 'create',
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      setSelectedLocationIds: vi.fn(),
      setBulkAssignmentsDialogOpen: vi.fn(),
    }) as never;

  const createSearch = () => ({
    tab: 'locations',
    masterDataTab: 'locations',
    fractionsView: 'list',
    toursView: 'list',
    locationsView: 'edit',
    schedulingView: 'list',
    q: '',
    page: 1,
    pageSize: 25,
    status: 'all',
    shiftContext: 'all',
    fractionsSortBy: 'name',
    fractionsSortDirection: 'asc',
  });

  it('submits edit views through the update path even if the dialog state still says create', async () => {
    const state = createState();

    const loadOverview = vi.fn(async () => undefined);
    const pt = (key: string) => key;
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt,
      search: createSearch(),
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitLocation({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    });

    expect(updateWasteManagementCollectionLocationMock).toHaveBeenCalledWith(
      'location-1',
      expect.objectContaining({
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
      })
    );
    expect(createWasteManagementCollectionLocationMock).not.toHaveBeenCalled();
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setLastOutcome).toHaveBeenCalledWith('location-update-success');
  });

  it('uses the create path and reports a success outcome for new locations', async () => {
    const state = createState();
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: {
        ...createSearch(),
        locationsView: 'list',
      },
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitLocation({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    }, 'create');

    expect(createWasteManagementCollectionLocationMock).toHaveBeenCalledTimes(1);
    expect(state.setLocationDialogOpen).toHaveBeenCalledWith(false);
    expect(state.setLastOutcome).toHaveBeenCalledWith('location-create-success');
  });

  it('uses RHF-submitted collection-location values as the real create source instead of stale state form data', async () => {
    const state = createState();
    state.locationForm = {
      id: 'location-1',
      regionId: 'stale-region',
      cityId: 'stale-city',
      streetId: 'stale-street',
      houseNumberId: 'stale-house',
      active: false,
    };
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: {
        ...createSearch(),
        locationsView: 'create',
      },
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitLocation(
      {
        id: 'location-1',
        regionId: 'region-2',
        cityId: 'city-2',
        streetId: 'street-2',
        houseNumberId: 'house-2',
        active: true,
      },
      'create'
    );

    expect(createWasteManagementCollectionLocationMock).toHaveBeenCalledWith({
      id: 'location-1',
      regionId: 'region-2',
      cityId: 'city-2',
      streetId: 'street-2',
      houseNumberId: 'house-2',
      active: true,
    });
  });

  it('surfaces a backend save reason for collection-location create failures when one is available', async () => {
    createWasteManagementCollectionLocationMock.mockRejectedValueOnce(
      new WasteManagementApiError(
        'database_unavailable',
        'Die Waste-Datenquelle verlangt derzeit eine Straße. "Alle Straßen" kann nicht gespeichert werden.'
      )
    );
    const state = createState();
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: {
        ...createSearch(),
        locationsView: 'create',
      },
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitLocation(
      {
        id: 'location-1',
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: '',
        houseNumberId: '',
        active: true,
      },
      'create'
    );

    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.messages.saveErrorWithReason',
    });
  });

  it('maps delete branches for single and bulk deletions', async () => {
    const state = createState();
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: createSearch(),
      loadOverview,
      selectedCollectionLocationIds: ['location-1', 'location-2'],
    });

    await handlers.onDeleteLocation({ id: 'location-1' });
    expect(deleteWasteManagementCollectionLocationMock).toHaveBeenCalledWith('location-1');
    expect(state.setSelectedLocationIds).toHaveBeenCalled();
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'masterData.collectionLocations.messages.deleteSuccess',
    });

    deleteWasteManagementCollectionLocationMock.mockRejectedValueOnce(
      new WasteManagementApiError('conflict', 'Konflikt')
    );
    await handlers.onDeleteLocation({ id: 'location-2' });
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.messages.deleteConflict',
    });

    deleteWasteManagementCollectionLocationMock.mockResolvedValue(undefined);
    await handlers.onDeleteLocations(['location-1', 'location-2']);
    expect(deleteWasteManagementCollectionLocationMock).toHaveBeenCalledWith('location-1');
    expect(deleteWasteManagementCollectionLocationMock).toHaveBeenCalledWith('location-2');
    expect(state.setSelectedLocationIds).toHaveBeenCalledWith([]);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'masterData.collectionLocations.bulk.messages.deleteSuccess',
    });

    deleteWasteManagementCollectionLocationMock.mockRejectedValueOnce(
      new WasteManagementApiError('forbidden', 'Verboten')
    );
    await handlers.onDeleteLocations(['location-3']);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.bulk.messages.deleteForbidden',
    });
  });

  it('submits bulk assignments and maps forbidden failures', async () => {
    const state = createState();
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: createSearch(),
      loadOverview,
      selectedCollectionLocationIds: ['location-1', 'location-2'],
    });

    await handlers.onSubmitBulkAssignments({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>);

    expect(createWasteManagementLocationTourLinksBulkMock).toHaveBeenCalledTimes(1);
    expect(state.setBulkAssignmentsDialogOpen).toHaveBeenCalledWith(false);
    expect(state.setSelectedLocationIds).toHaveBeenCalledWith([]);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'masterData.collectionLocations.bulk.messages.assignSuccess',
    });

    createWasteManagementLocationTourLinksBulkMock.mockRejectedValueOnce(
      new WasteManagementApiError('forbidden', 'Verboten')
    );
    await handlers.onSubmitBulkAssignments({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'masterData.collectionLocations.bulk.messages.assignForbidden',
    });
  });

  it('chunks master-data bulk assignments into multiple API requests when more than 100 locations are selected', async () => {
    const state = createState();
    const loadOverview = vi.fn(async () => undefined);
    const selectedCollectionLocationIds = Array.from({ length: 205 }, (_, index) => `location-${index + 1}`);
    createWasteManagementLocationTourLinksBulkMock.mockClear();
    const handlers = createWasteMasterDataLocationMutations({
      state,
      pt: (key: string) => key,
      search: createSearch(),
      loadOverview,
      selectedCollectionLocationIds,
    });

    await handlers.onSubmitBulkAssignments({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>);

    expect(createWasteManagementLocationTourLinksBulkMock).toHaveBeenCalledTimes(3);
    expect(createWasteManagementLocationTourLinksBulkMock).toHaveBeenNthCalledWith(1, {
      locationIds: selectedCollectionLocationIds.slice(0, 100),
      tourId: 'tour-1',
      startDate: undefined,
      endDate: undefined,
    });
    expect(createWasteManagementLocationTourLinksBulkMock).toHaveBeenNthCalledWith(2, {
      locationIds: selectedCollectionLocationIds.slice(100, 200),
      tourId: 'tour-1',
      startDate: undefined,
      endDate: undefined,
    });
    expect(createWasteManagementLocationTourLinksBulkMock).toHaveBeenNthCalledWith(3, {
      locationIds: selectedCollectionLocationIds.slice(200),
      tourId: 'tour-1',
      startDate: undefined,
      endDate: undefined,
    });
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setBulkAssignmentsDialogOpen).toHaveBeenCalledWith(false);
    expect(state.setSelectedLocationIds).toHaveBeenCalledWith([]);
  });
});
