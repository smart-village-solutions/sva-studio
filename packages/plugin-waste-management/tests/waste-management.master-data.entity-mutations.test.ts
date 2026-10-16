import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteMasterDataMutationHandlers } from '../src/waste-management.master-data-mutations.js';
import { confirmWasteAddressMove } from '../src/waste-management.master-data-address-move.js';

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
vi.mock('../src/waste-management.master-data-address-move.js', () => ({
  confirmWasteAddressMove: vi.fn(async () => 'confirmation-required'),
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
        cities: [{ id: 'city-1', regionId: 'region-1' }],
        streets: [{ id: 'street-1', cityId: 'city-1' }],
        houseNumbers: [{ id: 'house-1', streetId: 'street-1' }],
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

  it('treats clearing an optional city region as a confirmed parent move', async () => {
    const form = document.createElement('form');
    for (const [name, value] of [['name', 'Stadt Nord'], ['postalCode', '19300'], ['regionId', '']]) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.append(input);
    }
    const state = {
      cityDialogMode: 'edit',
      cityForm: { id: 'city-1', name: 'Stadt Nord', postalCode: '19300', regionId: 'region-1' },
      overview: {
        regions: [{ id: 'region-1', name: 'Nord' }],
        cities: [{ id: 'city-1', name: 'Stadt Nord', postalCode: '19300', regionId: 'region-1' }],
      },
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setCityDialogOpen: vi.fn(),
    };
    const handlers = createWasteMasterDataMutationHandlers({
      state: state as never,
      pt: (key) => key,
      search: {} as never,
      loadOverview: vi.fn(async () => undefined),
      loadCollectionLocationList: vi.fn(async () => undefined),
      selectedCollectionLocationIds: [],
    });

    await handlers.onSubmitCity({ preventDefault: vi.fn(), currentTarget: form } as never);

    expect(confirmWasteAddressMove).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'city', entityId: 'city-1', targetParentId: undefined,
      sourceLabel: 'Nord', targetLabel: 'masterData.locationsWorkspace.addresses.noParent',
    }));
    expect(apiMocks.updateWasteManagementCity).not.toHaveBeenCalled();
    const moveInput = vi.mocked(confirmWasteAddressMove).mock.calls[0]?.[0];
    await moveInput?.save('confirmation-token');
    expect(apiMocks.updateWasteManagementCity).toHaveBeenCalledWith('city-1', expect.objectContaining({
      regionId: null, confirmationToken: 'confirmation-token',
    }));
  });
});
