import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementPage } from '../src/waste-management.page.js';

const getWasteManagementSettingsMock = vi.hoisted(() => vi.fn(async () => null));
const getWasteMainserverSyncStatusMock = vi.hoisted(() =>
  vi.fn(async () => ({
    sourceState: 'pending' as const,
    expectedYearWindow: [2026, 2027] as const,
  }))
);
const startWasteManagementMainserverSyncMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'job-sync-1',
    status: 'queued',
    jobTypeId: 'waste-management.sync-mainserver',
  }))
);

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};
const navigateMock = vi.fn();
const searchState = {
  tab: 'tools',
  masterDataTab: 'locations',
  q: 'Restmüll',
  page: 3,
  pageSize: 50,
  status: 'active',
  tourValidityPeriod: 'all',
  tourWasteFractionId: undefined,
  shiftContext: 'tour',
  locationSortMode: 'address',
  locationSortDirection: 'asc',
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  firstDateFrom: undefined,
  firstDateTo: undefined,
  endDateFrom: undefined,
  endDateTo: undefined,
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
  schedulingTourId: undefined,
  schedulingOriginalDate: undefined,
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
  canRunMainserverSync: true,
  canRunReset: true,
  canOpenJobDetails: true,
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
  getWasteMainserverSyncStatus: getWasteMainserverSyncStatusMock,
  getWasteManagementSettings: getWasteManagementSettingsMock,
  startWasteManagementMainserverSync: startWasteManagementMainserverSyncMock,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Alert: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => <div className={className}>{children}</div>,
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
    getWasteMainserverSyncStatusMock.mockReset();
    getWasteMainserverSyncStatusMock.mockResolvedValue({
      sourceState: 'pending',
      expectedYearWindow: [2026, 2027],
    });
    navigateMock.mockReset();
    useWasteManagementUiAccessMock.mockReset();
    useWasteManagementUiAccessMock.mockReturnValue({
      isResolved: true,
      visibleTabIds: [
        'fractions',
        'tours',
        'locations',
        'scheduling',
        'output',
        'tools',
        'settings',
      ],
      canAccessSettings: true,
      canAccessTools: true,
      canRunInitialize: true,
      canRunMigrations: true,
      canRunImport: true,
      canRunSeed: true,
      canRunMainserverSync: true,
      canRunReset: true,
      canOpenJobDetails: true,
    });
    startWasteManagementMainserverSyncMock.mockReset();
    startWasteManagementMainserverSyncMock.mockResolvedValue({
      id: 'job-sync-1',
      status: 'queued',
      jobTypeId: 'waste-management.sync-mainserver',
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
    const publicCalendarLink = await screen.findByRole('link', {
      name: 'page.webVersionLinkLabel',
    });
    expect(publicCalendarLink.getAttribute('href')).toBe(
      'https://bb-prignitz.abfallkalender.smart-village.app/'
    );
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
      canRunMainserverSync: false,
      canRunReset: false,
      canOpenJobDetails: false,
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

  it('renders the pending sync action inside the status block and starts the mainserver sync job', async () => {
    render(<WasteManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'page.syncStatus.startAction' }));

    await waitFor(() => {
      expect(startWasteManagementMainserverSyncMock).toHaveBeenCalledWith({});
    });
  });

  it('keeps the successful start notice when the following status refresh fails', async () => {
    getWasteMainserverSyncStatusMock
      .mockResolvedValueOnce({ sourceState: 'pending', expectedYearWindow: [2026, 2027] })
      .mockRejectedValueOnce(new Error('status unavailable'));

    render(<WasteManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'page.syncStatus.startAction' }));

    expect(await screen.findByText('tools.sync.startSuccess')).toBeTruthy();
    expect(screen.queryByText('tools.sync.startError')).toBeNull();
  });

  it('waits for a polling response before scheduling the next status request', async () => {
    const activeStatus = {
      sourceState: 'pending' as const,
      expectedYearWindow: [2026, 2027] as const,
      activeJob: { id: 'job-sync-1', status: 'running' as const },
    };
    const pendingPoll = createDeferred<typeof activeStatus>();
    const scheduledPolls: Array<() => Promise<void>> = [];
    const nativeSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi
      .spyOn(window, 'setTimeout')
      .mockImplementation((handler: TimerHandler, timeout?: number) => {
        if (timeout === 3_000) {
          scheduledPolls.push(handler as () => Promise<void>);
          return 2_147_483_647;
        }
        return nativeSetTimeout(handler, timeout);
      });
    getWasteMainserverSyncStatusMock
      .mockResolvedValueOnce(activeStatus)
      .mockImplementationOnce(() => pendingPoll.promise);

    try {
      render(<WasteManagementPage />);
      expect(await screen.findByText('page.syncStatus.runningTitle')).toBeTruthy();
      await waitFor(() => expect(scheduledPolls).toHaveLength(1));

      act(() => void scheduledPolls[0]?.());
      expect(getWasteMainserverSyncStatusMock).toHaveBeenCalledTimes(2);
      expect(scheduledPolls).toHaveLength(1);

      await act(async () => {
        pendingPoll.resolve(activeStatus);
        await pendingPoll.promise;
      });
      await waitFor(() => expect(scheduledPolls).toHaveLength(2));
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('polls a clean status so in-page data changes become actionable without a remount', async () => {
    const cleanStatus = {
      sourceState: 'clean' as const,
      expectedYearWindow: [2026, 2027] as const,
    };
    const pendingStatus = {
      sourceState: 'pending' as const,
      expectedYearWindow: [2026, 2027] as const,
    };
    let poll: (() => Promise<void>) | undefined;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi
      .spyOn(window, 'setTimeout')
      .mockImplementation((handler: TimerHandler, timeout?: number) => {
        if (timeout === 10_000) {
          poll = handler as () => Promise<void>;
          return 2_147_483_647;
        }
        return nativeSetTimeout(handler, timeout);
      });
    getWasteMainserverSyncStatusMock
      .mockResolvedValueOnce(cleanStatus)
      .mockResolvedValueOnce(pendingStatus);

    try {
      render(<WasteManagementPage />);
      expect(await screen.findByText('page.syncStatus.cleanTitle')).toBeTruthy();
      await waitFor(() => expect(poll).toBeTypeOf('function'));

      await act(async () => {
        await poll?.();
      });
      expect(await screen.findByText('page.syncStatus.pendingTitle')).toBeTruthy();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
