import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeWasteManagementSearchParams } from '../src/search-params.js';
import { WasteMasterDataLocationsTabView } from '../src/waste-management.master-data-locations-tab-view.js';
import type { useWasteMasterDataViewModel } from '../src/use-waste-master-data-view-model.js';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children, search }: React.PropsWithChildren<{ search: unknown }>) => (
    <a
      href="#edit"
      onClick={(event) => {
        event.preventDefault();
        navigate({ search });
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('../src/waste-management.master-data-locations-workspace.paged.js', () => ({
  WasteMasterDataPagedLocationsTable: () => <div>location-table</div>,
}));
vi.mock('../src/waste-management.master-data-location-form-content.js', () => ({
  WasteMasterDataLocationFormContent: ({ onCancel }: { onCancel: () => void }) => (
    <button type="button" onClick={onCancel}>
      cancel-edit
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

const timestamp = '2026-01-01T00:00:00Z';
const location = {
  id: 'location-1',
  cityId: 'city-1',
  active: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const controller = {
  overview: { collectionLocations: [location], locationTourLinks: [] },
  locationCoverageFractions: [
    {
      id: 'paper',
      name: 'Paper',
      status: 'published',
      color: '#000000',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  locationCoverageFractionsStatus: 'ready',
  locationCoverageToursStatus: 'ready',
  availableTours: [],
  selectedLocationIds: [],
  filteredCollectionLocations: [location],
  getLocationLabel: () => 'Test location',
  setLocationDialogOpen: vi.fn(),
  resetLocationForm: vi.fn(),
  setMessage: vi.fn(),
  setLastOutcome: vi.fn(),
} as unknown as ReturnType<typeof useWasteMasterDataViewModel>;

describe('location coverage edit navigation', () => {
  it('keeps criteria when cancelling an assignment edit', () => {
    let search = normalizeWasteManagementSearchParams({
      tab: 'locations',
      masterDataTab: 'locations',
      q: 'Test',
      regionId: 'region-1',
      cityId: 'city-1',
      tourId: 'tour-filter',
      locationYear: 2027,
      locationTourStatus: 'draft',
      page: 4,
    });
    const { rerender } = render(
      <WasteMasterDataLocationsTabView controller={controller} search={search} />
    );
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.year'), {
      target: { value: '2027' },
    });
    fireEvent.click(screen.getByLabelText('masterData.locationsWorkspace.coverage.includeDrafts'));
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );
    fireEvent.click(
      screen.getByRole('link', { name: 'masterData.locationsWorkspace.coverage.edit' })
    );
    search = navigate.mock.lastCall?.[0].search;
    rerender(<WasteMasterDataLocationsTabView controller={controller} search={search} />);
    expect(
      screen.queryByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'cancel-edit' }));
    search = navigate.mock.lastCall?.[0].search;
    rerender(<WasteMasterDataLocationsTabView controller={controller} search={search} />);
    expect(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction')).toHaveProperty(
      'value',
      'paper'
    );
    expect(screen.getByLabelText('masterData.locationsWorkspace.coverage.year')).toHaveProperty(
      'value',
      '2027'
    );
    expect(
      screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate')
    ).toHaveProperty('value', '2027-01-01');
    expect(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate')).toHaveProperty(
      'value',
      '2027-12-31'
    );
    expect(
      screen.getByLabelText('masterData.locationsWorkspace.coverage.includeDrafts')
    ).toHaveProperty('checked', false);
    // Results are invalidated when the suspended effects resume; the saved criteria can be reused.
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );
    expect(
      screen.getByRole('link', { name: 'masterData.locationsWorkspace.coverage.edit' })
    ).toBeTruthy();
    expect(search).toMatchObject({
      q: 'Test',
      regionId: 'region-1',
      cityId: 'city-1',
      tourId: 'tour-filter',
      locationYear: 2027,
      locationTourStatus: 'draft',
      page: 4,
      locationsView: 'list',
    });
  });
});
