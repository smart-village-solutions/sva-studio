import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteMasterDataMutationHandlers } from '../src/waste-management.master-data-mutations.js';

const apiMocks = vi.hoisted(() => ({
  updateWasteManagementRegion: vi.fn(async () => undefined),
  updateWasteManagementCity: vi.fn(async () => undefined),
  updateWasteManagementStreet: vi.fn(async () => undefined),
  updateWasteManagementHouseNumber: vi.fn(async () => undefined),
}));

vi.mock('../src/waste-management.api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/waste-management.api.js')>()),
  ...apiMocks,
}));

const createSubmitEvent = () =>
  ({
    preventDefault: vi.fn(),
    currentTarget: document.createElement('form'),
  }) as unknown as React.FormEvent<HTMLFormElement>;

describe('waste master-data address entity mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads the paginated location projection after successful address updates', async () => {
    const loadOverview = vi.fn(async () => undefined);
    const loadCollectionLocationList = vi.fn(async () => undefined);
    const state = {
      regionDialogMode: 'edit',
      regionForm: { id: 'region-1', name: 'Region Nord' },
      cityDialogMode: 'edit',
      cityForm: { id: 'city-1', name: 'Stadt Nord', postalCode: '19300', regionId: 'region-1' },
      streetDialogMode: 'edit',
      streetForm: { id: 'street-1', name: 'Nordstraße', cityId: 'city-1' },
      houseNumberDialogMode: 'edit',
      houseNumberForm: { id: 'house-1', number: '12a', streetId: 'street-1' },
      overview: {
        regions: [{ id: 'region-1' }],
        cities: [{ id: 'city-1' }],
        streets: [{ id: 'street-1' }],
      },
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
      setRegionDialogOpen: vi.fn(),
      setCityDialogOpen: vi.fn(),
      setStreetDialogOpen: vi.fn(),
      setHouseNumberDialogOpen: vi.fn(),
    };
    const handlers = createWasteMasterDataMutationHandlers({
      state: state as never,
      pt: (key) => key,
      search: {} as never,
      loadOverview,
      loadCollectionLocationList,
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitRegion(createSubmitEvent());
    await handlers.onSubmitCity(createSubmitEvent());
    await handlers.onSubmitStreet(createSubmitEvent());
    await handlers.onSubmitHouseNumber(createSubmitEvent());

    expect(apiMocks.updateWasteManagementRegion).toHaveBeenCalledOnce();
    expect(apiMocks.updateWasteManagementCity).toHaveBeenCalledOnce();
    expect(apiMocks.updateWasteManagementStreet).toHaveBeenCalledOnce();
    expect(apiMocks.updateWasteManagementHouseNumber).toHaveBeenCalledOnce();
    expect(loadOverview).toHaveBeenCalledTimes(4);
    expect(loadCollectionLocationList).toHaveBeenCalledTimes(4);
  });
});
