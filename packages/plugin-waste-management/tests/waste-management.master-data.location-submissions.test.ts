import { describe, expect, it, vi } from 'vitest';

const createWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementCollectionLocationMock = vi.hoisted(() => vi.fn(async () => undefined));

import { createWasteMasterDataLocationSubmissions } from '../src/waste-management.master-data.location-submissions.js';

vi.mock('../src/waste-management.api.js', () => ({
  createWasteManagementCollectionLocation: createWasteManagementCollectionLocationMock,
  createWasteManagementLocationTourLinksBulk: vi.fn(async () => undefined),
  updateWasteManagementCollectionLocation: updateWasteManagementCollectionLocationMock,
}));

describe('createWasteMasterDataLocationSubmissions', () => {
  it('submits edit views through the update path even if the dialog state still says create', async () => {
    const state = {
      locationForm: {
        id: 'location-1',
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        active: true,
      },
      locationDialogMode: 'create',
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
      setLocationDialogOpen: vi.fn(),
    } as never;

    const loadOverview = vi.fn(async () => undefined);
    const pt = (key: string) => key;
    const handlers = createWasteMasterDataLocationSubmissions({
      state,
      pt,
      search: {
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
      },
      loadOverview,
      selectedCollectionLocationIds: [],
    });

    const form = document.createElement('form');
    form.innerHTML = `
      <select name="regionId"><option value="region-1" selected>region-1</option></select>
      <select name="cityId"><option value="city-1" selected>city-1</option></select>
      <select name="streetId"><option value="street-1" selected>street-1</option></select>
      <select name="houseNumberId"><option value="house-1" selected>house-1</option></select>
    `;

    const event = {
      preventDefault: vi.fn(),
      currentTarget: form,
    } as unknown as React.FormEvent<HTMLFormElement>;

    await handlers.onSubmitLocation(event);

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
});
