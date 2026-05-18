import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementPageTabs } from '../src/waste-management.page.layout.js';

const { tabsContentSpy } = vi.hoisted(() => ({
  tabsContentSpy: vi.fn(
    ({
      value,
      forceMount,
      className,
      children,
    }: {
      readonly value: string;
      readonly forceMount?: boolean;
      readonly className?: string;
      readonly children: React.ReactNode;
    }) => (
      <div data-value={value} data-force-mount={forceMount ? 'true' : 'false'} className={className}>
        {children}
      </div>
    )
  ),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Tabs: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => <div className={className}>{children}</div>,
  TabsList: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => <div className={className}>{children}</div>,
  TabsTrigger: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  TabsContent: tabsContentSpy,
}));

vi.mock('../src/waste-management.master-data-panel.js', () => ({
  WasteMasterDataPanel: ({ tab }: { readonly tab: string }) => <div>{`master-data:${tab}`}</div>,
}));

vi.mock('../src/waste-management.tours-panel.js', () => ({
  WasteToursPanel: () => <div>tours</div>,
}));

vi.mock('../src/waste-management.scheduling-panel.js', () => ({
  WasteSchedulingPanel: () => <div>scheduling</div>,
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

  it('keeps all tab panels mounted so switching tabs does not remount panel state', () => {
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
      />
    );

    expect(tabsContentSpy).toHaveBeenCalledTimes(6);
    expect(tabsContentSpy.mock.calls[0]?.[0]?.forceMount).toBeUndefined();
    expect(tabsContentSpy.mock.calls[1]?.[0]?.forceMount).toBeUndefined();

    tabsContentSpy.mockClear();

    rerender(
      <WasteManagementPageTabs
        pt={(key) => key}
        search={{
          ...search,
          tab: 'tours',
        }}
        onTabChange={() => undefined}
      />
    );

    expect(tabsContentSpy).toHaveBeenCalledTimes(12);
    expect(tabsContentSpy.mock.calls[0]?.[0]?.forceMount).toBe(true);
    expect(tabsContentSpy.mock.calls[1]?.[0]?.forceMount).toBeUndefined();
    expect(tabsContentSpy.mock.calls[6]?.[0]?.forceMount).toBe(true);
    expect(tabsContentSpy.mock.calls[7]?.[0]?.forceMount).toBeUndefined();
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
      />
    );

    expect(screen.getAllByText('tabs.fractions.title').length).toBeGreaterThan(1);
    expect(screen.getAllByText('tabs.fractions.body').length).toBeGreaterThan(0);
    expect(screen.queryByText('meta.page')).toBeNull();
    expect(screen.queryByText('meta.pageSize')).toBeNull();

    expect(document.querySelector('button.mb-\\[-1px\\].border-b-\\[3px\\].border-primary.text-primary')).toBeTruthy();
    expect(document.querySelector('button.border-transparent.text-muted-foreground')).toBeTruthy();
    expect(document.querySelector('.ml-\\[10px\\].gap-10')).toBeTruthy();
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
      />
    );

    expect(document.querySelector('.space-y-0')).toBeTruthy();
    expect(tabsContentSpy.mock.calls[0]?.[0]?.className).toContain('mt-0');
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
      />
    );

    const [tabDescription] = screen.getAllByText('tabs.fractions.body');
    const tabPanelSurface = tabDescription.closest('section')?.parentElement;
    expect(tabPanelSurface?.className).toContain('bg-[rgb(var(--waste-panel-surface))]');
    expect(tabPanelSurface?.className).toContain('border');
    expect(tabPanelSurface?.className).toContain('rounded-2xl');
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
      />
    );

    expect(screen.getAllByText('tools').length).toBeGreaterThan(0);
    expect(screen.getAllByText('overview').length).toBeGreaterThan(0);
  });

  it('omits settings and tools tabs when the current UI access does not allow them', () => {
    tabsContentSpy.mockClear();

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
        visibleTabIds={['fractions', 'tours', 'locations', 'scheduling']}
        onTabChange={() => undefined}
      />
    );

    expect(screen.queryAllByText('tabs.tools.title')).toHaveLength(0);
    expect(screen.queryAllByText('tabs.settings.title')).toHaveLength(0);
    expect(tabsContentSpy).toHaveBeenCalledTimes(4);
  });
});
