import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementPageTabs } from '../src/waste-management.page.layout.js';

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
