import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishSessionAccessSnapshot, readSessionAccessSnapshot } from '@sva/plugin-sdk';

import { WasteManagementPageTabs } from '../src/waste-management.page.layout.js';
import { useWasteManagementTabNavigation } from '../src/waste-management.page.navigation.js';
import { normalizeWasteManagementSearchParams } from '../src/search-params.js';

type TabNavigation = Parameters<typeof useWasteManagementTabNavigation>;

const TabNavigationHarness = ({
  navigate,
  rawSearch,
  access,
}: {
  navigate: TabNavigation[0];
  rawSearch: Record<string, unknown>;
  access: TabNavigation[2];
}) => {
  const { search, changeTab } = useWasteManagementTabNavigation(
    navigate,
    normalizeWasteManagementSearchParams(rawSearch),
    access,
    JSON.stringify(rawSearch)
  );
  return (
    <WasteManagementPageTabs
      pt={(key) => key}
      search={search}
      onTabChange={changeTab}
      onAddressSearchChange={() => undefined}
    />
  );
};

vi.mock('../src/waste-management.master-data-panel.js', () => ({
  WasteMasterDataPanel: ({ tab }: { readonly tab: string }) => (
    <div>
      {`master-data:${tab}`}
      <input aria-label={`draft:${tab}`} />
    </div>
  ),
}));

vi.mock('../src/waste-management.master-data-addresses-panel.js', () => ({
  WasteMasterDataAddressesPanel: () => <div>address-master-data</div>,
}));

vi.mock('../src/waste-management.tours-panel.js', () => ({
  WasteToursPanel: () => <div>tours</div>,
}));

vi.mock('../src/waste-management.scheduling-panel.js', () => ({
  WasteSchedulingPanel: () => <div>scheduling</div>,
}));

vi.mock('../src/waste-management.output-panel.js', () => ({
  WasteOutputPanel: () => <div>output</div>,
}));

vi.mock('../src/waste-management.tools-panel.js', () => ({
  WasteToolsPanel: ({ overview }: { readonly overview?: React.ReactNode }) => (
    <div>
      <div>tools</div>
      {overview}
    </div>
  ),
}));

vi.mock('../src/waste-management.settings-panel.js', () => ({
  WasteSettingsPanel: () => <div>settings</div>,
}));

vi.mock('../src/waste-management.overview-panel.js', () => ({
  WasteOverviewPanel: () => <div>overview</div>,
}));

describe('WasteManagementPageTabs', () => {
  afterEach(() => {
    cleanup();
    publishSessionAccessSnapshot({
      isResolved: !readSessionAccessSnapshot().isResolved,
      permissionActions: [],
      assignedModules: [],
      roles: [],
    });
  });

  it('restores each tab’s own filters and keeps a reset confined to its tab', () => {
    const navigate = vi.fn();
    const access = { contextKey: 'subject-1:tenant-1', canRead: true, isResolved: true };
    const locations = {
      tab: 'locations',
      locationsView: 'edit',
      collectionLocationId: 'location-1',
      q: 'Perleberg',
      regionId: 'region-1',
      tourId: 'location-tour',
      locationYear: 2027,
      locationTourStatus: 'published',
      pageSize: 25,
      page: 3,
    };
    const tours = {
      tab: 'tours',
      q: 'Papier',
      tourStatus: 'draft',
      tourValidityPeriod: 'next',
      tourWasteFractionId: 'paper',
      toursView: 'edit',
      tourId: 'edit-tour',
    };
    const view = render(
      <TabNavigationHarness navigate={navigate} rawSearch={locations} access={access} />
    );
    const selectTab = (tab: string) =>
      fireEvent.click(screen.getByRole('tab', { name: `tabs.${tab}.title` }));
    const checkSearch = (search: Record<string, unknown>) =>
      expect(navigate).toHaveBeenLastCalledWith({
        to: '/plugins/waste-management',
        search: expect.objectContaining(search),
      });

    selectTab('tours');
    checkSearch({ tab: 'tours', q: '', regionId: undefined, tourId: undefined, pageSize: 100 });
    view.rerender(<TabNavigationHarness navigate={navigate} rawSearch={tours} access={access} />);
    selectTab('locations');
    checkSearch({ ...locations, page: 1, tourWasteFractionId: undefined });
    view.rerender(
      <TabNavigationHarness
        navigate={navigate}
        rawSearch={{
          tab: 'locations',
          locationsView: 'edit',
          collectionLocationId: 'location-1',
          pageSize: 25,
        }}
        access={access}
      />
    );
    selectTab('tours');
    checkSearch({ ...tours, toursView: 'list', tourId: undefined });
    expect(navigate.mock.lastCall?.[0].search.locationYear).toBeUndefined();
    view.rerender(<TabNavigationHarness navigate={navigate} rawSearch={tours} access={access} />);
    selectTab('locations');
    checkSearch({
      tab: 'locations',
      locationsView: 'edit',
      collectionLocationId: 'location-1',
      q: '',
      tourId: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it('keeps filters through passive reauthentication and forgets the active route on logout', () => {
    const navigate = vi.fn();
    const access = { contextKey: 'subject-1:tenant-1', canRead: true, isResolved: true };
    const locations = {
      tab: 'locations',
      locationsView: 'edit',
      collectionLocationId: 'location-1',
      q: 'vorheriger Filter',
    };
    const explicitTourLink = { tab: 'tours', q: 'Deep Link', tourValidityPeriod: 'current' };
    const view = render(
      <TabNavigationHarness navigate={navigate} rawSearch={locations} access={access} />
    );
    const showTours = (nextAccess: TabNavigation[2]) =>
      view.rerender(
        <TabNavigationHarness navigate={navigate} rawSearch={explicitTourLink} access={nextAccess} />
      );
    const selectTab = (tab: string) =>
      fireEvent.click(screen.getByRole('tab', { name: `tabs.${tab}.title` }));
    const checkLocationsQuery = (q: string) =>
      expect(navigate).toHaveBeenLastCalledWith({
        to: '/plugins/waste-management',
        search: expect.objectContaining({ tab: 'locations', q }),
      });

    selectTab('tours');
    showTours({ ...access, canRead: false, isResolved: false });
    showTours(access);
    selectTab('locations');
    checkLocationsQuery('vorheriger Filter');

    showTours({ contextKey: null, canRead: false, isResolved: true });
    showTours(access);
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ tab: 'tours', q: '', tourValidityPeriod: 'all' }),
      replace: true,
    });
    selectTab('locations');
    checkLocationsQuery('');
    expect(navigate.mock.lastCall?.[0].search.collectionLocationId).toBeUndefined();
    view.rerender(
      <TabNavigationHarness navigate={navigate} rawSearch={{ tab: 'locations' }} access={access} />
    );
    selectTab('tours');
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        tab: 'tours',
        q: '',
        tourValidityPeriod: 'all',
      }),
    });

    const nextAccess = { ...access, contextKey: 'subject-1:tenant-2' };
    const nextLink = { ...explicitTourLink, q: 'Frisch geöffneter Link' };
    view.rerender(<TabNavigationHarness navigate={navigate} rawSearch={nextLink} access={nextAccess} />);
    selectTab('locations');
    checkLocationsQuery('');
    view.rerender(
      <TabNavigationHarness navigate={navigate} rawSearch={{ tab: 'locations' }} access={nextAccess} />
    );
    selectTab('tours');
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining(nextLink),
    });
  });

  it('retains the open editor across route remounts and clears it on logout while unmounted', () => {
    const navigate = vi.fn();
    const access = {
      contextKey: JSON.stringify(['subject-remount', 'tenant-remount', null]),
      canRead: true,
      isResolved: true,
    };
    publishSessionAccessSnapshot({
      isResolved: true,
      subjectId: 'subject-remount',
      instanceId: 'tenant-remount',
      organizationId: null,
      permissionActions: ['waste-management.read'],
      assignedModules: ['waste-management'],
      roles: [],
    });
    const locations = {
      tab: 'locations',
      q: 'Perleberg',
      locationsView: 'edit',
      collectionLocationId: 'remounted-location',
    };
    const firstTab = render(
      <TabNavigationHarness
        navigate={navigate}
        rawSearch={locations}
        access={access}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.tours.title' }));
    firstTab.unmount();

    const secondMount = render(
      <TabNavigationHarness navigate={navigate} rawSearch={{ tab: 'tours' }} access={access} />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.locations.title' }));
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining(locations),
    });
    secondMount.unmount();
    act(() =>
      publishSessionAccessSnapshot({
        isResolved: false,
        permissionActions: [],
        assignedModules: [],
        roles: [],
      })
    );
    render(<TabNavigationHarness navigate={navigate} rawSearch={{ tab: 'tours' }} access={access} />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.locations.title' }));
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        tab: 'locations',
        q: '',
        collectionLocationId: undefined,
        locationsView: 'list',
      }),
    });
  });

  it('keeps visited panels and their input mounted across route-driven tab changes', () => {
    const search = {
      masterDataTab: 'locations' as const,
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all' as const,
      shiftContext: 'all' as const,
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourId: undefined,
    };

    const { rerender } = render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          ...search,
          tab: 'fractions',
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'draft:fractions' }), {
      target: { value: 'Offener Entwurf' },
    });
    expect(screen.queryByText('tours', { exact: true })).toBeNull();

    rerender(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          ...search,
          tab: 'tours',
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect((screen.getByLabelText('draft:fractions') as HTMLInputElement).value).toBe(
      'Offener Entwurf'
    );
    expect(screen.getByText('tours', { exact: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.tours.title' }).getAttribute('data-state')).toBe(
      'active'
    );
  });

  it('renders tab-specific info content inside each panel and no global badges', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'fractions',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect(screen.getAllByText('tabs.fractions.title').length).toBeGreaterThan(1);
    expect(screen.getAllByText('tabs.fractions.body').length).toBeGreaterThan(0);
    expect(screen.queryByText('meta.page')).toBeNull();
    expect(screen.queryByText('meta.pageSize')).toBeNull();

    expect(
      screen.getByRole('tab', { name: 'tabs.fractions.title' }).getAttribute('data-state')
    ).toBe('active');
    expect(screen.getByRole('tab', { name: 'tabs.tours.title' }).getAttribute('data-state')).toBe(
      'inactive'
    );
  });

  it('renders the canonical master-data panel for the active top-level tab', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'fractions',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect(screen.getAllByText('master-data:fractions').length).toBeGreaterThan(0);
  });

  it('lets the tab list and tab panels sit flush without vertical gap', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'fractions',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect(document.querySelector('.space-y-0')).toBeTruthy();
    expect(screen.getByRole('tabpanel').className).toContain('mt-0');
  });

  it('wraps each tab panel in a darker content surface', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'fractions',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    const [tabDescription] = screen.getAllByText('tabs.fractions.body');
    const tabPanelSurface = tabDescription.closest('[role=tabpanel]')?.firstElementChild;
    expect(tabPanelSurface?.className).toContain('bg-surface-inset');
    expect(tabPanelSurface?.className).toContain('border');
    expect(tabPanelSurface?.className).toContain('rounded-lg');
  });

  it('wires the overview panel into the tools tab content', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'tools',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect(screen.getAllByText('tools').length).toBeGreaterThan(0);
    expect(screen.getAllByText('overview').length).toBeGreaterThan(0);
  });

  it('renders the dedicated output tab panel', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'output',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        onTabChange={() => undefined}
        onAddressSearchChange={() => undefined}
      />
    );

    expect(screen.getAllByText('output').length).toBeGreaterThan(0);
    expect(screen.getAllByText('tabs.output.title').length).toBeGreaterThan(0);
  });

  it('omits settings and tools tabs when the current UI access does not allow them', () => {
    render(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          tab: 'fractions',
          masterDataTab: 'locations',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
        }}
        visibleTabIds={['fractions', 'tours', 'locations', 'scheduling', 'output']}
        onAddressSearchChange={() => undefined}
        onTabChange={() => undefined}
      />
    );

    expect(screen.queryAllByText('tabs.tools.title')).toHaveLength(0);
    expect(screen.queryAllByText('tabs.settings.title')).toHaveLength(0);
    expect(screen.getAllByText('tabs.output.title').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});
