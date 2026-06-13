import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.js';
import { WasteSettingsPanel } from '../src/waste-management.settings-panel.js';
import { useWasteMasterDataDataLoading } from '../src/waste-management.master-data.loaders.js';
import { useWasteMasterDataState } from '../src/waste-management.master-data.state.js';
import { useWasteSchedulingDataLoading } from '../src/waste-management.scheduling.loaders.js';
import { useWasteSchedulingState } from '../src/waste-management.scheduling.state.js';
import { useWasteToursDataLoading } from '../src/waste-management.tours.loaders.js';
import { useWasteToursState } from '../src/waste-management.tours.state.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementMasterDataOverview: vi.fn(),
  getWasteManagementSchedulingOverview: vi.fn(),
  getWasteManagementSettings: vi.fn(),
  getWasteManagementToursOverview: vi.fn(),
  updateWasteManagementSettings: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
  wasteManagementMasterDataContract: {
    fractionReminderLeadDayMin: 1,
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.api.js')>('../src/waste-management.api.js');

  return {
    ...actual,
    ...apiMocks,
  };
});

vi.mock('../src/waste-management.page.support.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.page.support.js')>(
    '../src/waste-management.page.support.js'
  );

  return {
    ...actual,
    StatusNotice: () => <div>status-notice</div>,
  };
});

vi.mock('../src/waste-management.settings-form.js', () => ({
  WasteSettingsForm: () => <form>settings-form</form>,
}));

vi.mock('../src/waste-management.settings-status-panel.js', () => ({
  WasteSettingsStatusPanel: () => <div>settings-status</div>,
}));

const createForbiddenError = () => new WasteManagementApiError('forbidden');

const MasterDataLoaderHarness = () => {
  const state = useWasteMasterDataState();
  useWasteMasterDataDataLoading(state, (key) => key, 'fractions');

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const LocationsMasterDataLoaderHarness = () => {
  const state = useWasteMasterDataState();
  useWasteMasterDataDataLoading(state, (key) => key, 'locations');

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const DynamicMasterDataLoaderHarness = ({ tab }: { readonly tab: 'fractions' | 'locations' }) => {
  const state = useWasteMasterDataState();
  useWasteMasterDataDataLoading(state, (key) => key, tab);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const ToursLoaderHarness = () => {
  const state = useWasteToursState();
  useWasteToursDataLoading(state, (key) => key);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const SchedulingLoaderHarness = () => {
  const state = useWasteSchedulingState();
  useWasteSchedulingDataLoading(state, (key) => key);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

describe('waste management data loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the master-data loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementMasterDataOverview.mockRejectedValue(createForbiddenError());

    render(<MasterDataLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('masterData.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({ scope: 'fractions' });
    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(0);
  });

  it('keeps the tours loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementToursOverview.mockRejectedValue(createForbiddenError());
    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({ fractions: [] });
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({ globalDateShifts: [], tourDateShifts: [] });

    render(<ToursLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('tours.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({ scope: 'fractions' });
    expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(0);
  });

  it('loads location master data through the scoped locations endpoint and tours separately', async () => {
    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });

    render(<LocationsMasterDataLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    await waitFor(() => {
      expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({ scope: 'locations' });
  });

  it('reloads the master-data overview when the active tab scope changes', async () => {
    apiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [],
      })
      .mockResolvedValueOnce({
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      });
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });

    const { rerender } = render(<DynamicMasterDataLoaderHarness tab="fractions" />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(1, { scope: 'fractions' });

    rerender(<DynamicMasterDataLoaderHarness tab="locations" />);

    await waitFor(() => {
      expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(2, { scope: 'locations' });
    });
  });

  it('keeps the scheduling loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementSchedulingOverview.mockRejectedValue(createForbiddenError());

    render(<SchedulingLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('scheduling.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(0);
  });

  it('loads tour fractions first and the location assignment context in the background', async () => {
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });
    apiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [{ id: 'fraction-1' }],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      })
      .mockResolvedValueOnce({
        fractions: [],
        regions: [{ id: 'region-1' }],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [{ id: 'location-1' }],
        locationTourLinks: [{ id: 'link-1' }],
      });
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({ globalDateShifts: [], tourDateShifts: [] });

    render(<ToursLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    await waitFor(() => {
      expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(2);
      expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(1, { scope: 'fractions' });
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(2, { scope: 'locations' });
  });

  it('keeps the settings loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementSettings.mockRejectedValue(createForbiddenError());

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('settings.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(1);
  });
});
