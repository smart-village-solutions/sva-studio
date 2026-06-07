import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementPage } from '../src/waste-management.page.js';

const getWasteManagementSettingsMock = vi.hoisted(() => vi.fn(async () => null));
const navigateMock = vi.fn();
const searchState = {
  tab: 'tools',
  masterDataTab: 'locations',
  q: 'Restmüll',
  page: 3,
  pageSize: 50,
  status: 'active',
  shiftContext: 'tour',
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
};
const useWasteManagementUiAccessMock = vi.fn(() => ({
  isResolved: true,
  visibleTabIds: ['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings'],
  canAccessSettings: true,
  canAccessTools: true,
  canRunInitialize: true,
  canRunMigrations: true,
  canRunImport: true,
  canRunSeed: true,
  canRunReset: true,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchState,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.ui-access.js', () => ({
  useWasteManagementUiAccess: () => useWasteManagementUiAccessMock(),
}));

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementSettings: getWasteManagementSettingsMock,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioOverviewPageTemplate: ({
    title,
    description,
    primaryAction,
    toolbar,
    children,
  }: {
    readonly title: string;
    readonly description: React.ReactNode;
    readonly primaryAction: React.ReactNode;
    readonly toolbar?: React.ReactNode;
    readonly children: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{primaryAction}</div>
      <div>{toolbar}</div>
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('../src/waste-management.page.layout.js', () => ({
  WasteManagementPageToolbar: ({
    onSearchChange,
    onStatusChange,
    onShiftContextChange,
  }: {
    readonly onSearchChange: (value: string) => void;
    readonly onStatusChange: (value: string) => void;
    readonly onShiftContextChange: (value: string) => void;
  }) => (
    <div>
      <button onClick={() => onSearchChange('Bio')}>change-search</button>
      <button onClick={() => onStatusChange('inactive')}>change-status</button>
      <button onClick={() => onShiftContextChange('global')}>change-shift-context</button>
    </div>
  ),
  WasteManagementPageTabs: ({
    onTabChange,
    visibleTabIds,
  }: {
    readonly onTabChange: (value: 'overview' | 'settings') => void;
    readonly visibleTabIds: readonly string[];
  }) => (
    <div>
      <div>{visibleTabIds.join(',')}</div>
      <button onClick={() => onTabChange('settings')}>change-tab</button>
    </div>
  ),
  wasteManagementTabTranslationKeyMap: {},
}));

describe('WasteManagementPage shell', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    getWasteManagementSettingsMock.mockReset();
    getWasteManagementSettingsMock.mockResolvedValue(null);
    navigateMock.mockReset();
    useWasteManagementUiAccessMock.mockReset();
    useWasteManagementUiAccessMock.mockReturnValue({
      isResolved: true,
      visibleTabIds: ['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings'],
      canAccessSettings: true,
      canAccessTools: true,
      canRunInitialize: true,
      canRunMigrations: true,
      canRunImport: true,
      canRunSeed: true,
      canRunReset: true,
    });
    searchState.tab = 'tools';
    searchState.masterDataTab = 'locations';
  });

  it('renders the shell without the global toolbar and resets pagination for tab changes', async () => {
    getWasteManagementSettingsMock.mockResolvedValue({
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
    });

    render(<WasteManagementPage />);

    expect(screen.getByText('page.title')).toBeTruthy();
    expect(screen.getByText('page.description')).toBeTruthy();
    const publicCalendarLink = await screen.findByRole('link', { name: 'page.webVersionLinkLabel' });
    expect(publicCalendarLink.getAttribute('href')).toBe('https://bb-prignitz.abfallkalender.smart-village.app/');
    expect(publicCalendarLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('button', { name: 'change-search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'change-status' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'change-shift-context' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'actions.openSettings' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'change-tab' }));
    expect(navigateMock).toHaveBeenNthCalledWith(1, {
      to: '/plugins/waste-management',
      search: {
        ...searchState,
        collectionLocationId: undefined,
        duplicateFromTourId: undefined,
        fractionsSortBy: 'name',
        fractionsSortDirection: 'asc',
        fractionsStatus: 'all',
        fractionsView: 'list',
        globalDateShiftId: undefined,
        toursView: 'list',
        locationsView: 'list',
        schedulingView: 'list',
        tab: 'settings',
        page: 1,
        tourDateShiftId: undefined,
      },
    });
  });

  it('hides the settings shortcut and redirects forbidden deep links back to the first visible tab', async () => {
    searchState.tab = 'settings';
    searchState.masterDataTab = 'locations';
    useWasteManagementUiAccessMock.mockReturnValue({
      isResolved: true,
      visibleTabIds: ['fractions', 'tours', 'locations', 'scheduling'],
      canAccessSettings: false,
      canAccessTools: false,
      canRunInitialize: false,
      canRunMigrations: false,
      canRunImport: false,
      canRunSeed: false,
      canRunReset: false,
    });

    render(<WasteManagementPage />);

    expect(screen.queryByRole('button', { name: 'actions.openSettings' })).toBeNull();
    expect(screen.getByText('fractions,tours,locations,scheduling')).toBeTruthy();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/plugins/waste-management',
        search: {
          ...searchState,
          collectionLocationId: undefined,
          duplicateFromTourId: undefined,
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          fractionsStatus: 'all',
          fractionsView: 'list',
          globalDateShiftId: undefined,
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'list',
          tab: 'fractions',
          masterDataTab: 'fractions',
          page: 1,
          tourDateShiftId: undefined,
        },
        replace: true,
      });
    });
  });
});
