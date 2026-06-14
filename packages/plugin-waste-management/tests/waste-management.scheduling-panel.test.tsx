import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingPanel } from '../src/waste-management.scheduling-panel.js';

const navigateMock = vi.fn();
const controllerMock = vi.hoisted(() => ({
  loading: false,
  error: null,
  lastOutcome: 'create-success' as const,
  overview: null as null | {
    holidayRules?: readonly {
      id: string;
      holidayDate: string;
      holidayName: string;
      year: number;
      stateCode: string;
      sourceStatus: string;
      configurationStatus: string;
      conflictStatus: string;
      createdAt: string;
      updatedAt: string;
    }[];
    globalDateShifts: readonly {
      id: string;
      originalDate: string;
      actualDate: string;
      hasYear: boolean;
      createdAt: string;
      updatedAt: string;
      description?: string | null;
      reasonType?: string | null;
      reasonKey?: string | null;
      tourIds?: readonly string[] | null;
    }[];
    tourDateShifts: readonly {
      id: string;
      tourId: string;
      originalDate: string;
      actualDate: string;
      hasYear: boolean;
      createdAt: string;
      updatedAt: string;
      description?: string | null;
      reasonType?: string | null;
      reasonKey?: string | null;
      followUpMode?: string | null;
    }[];
  },
  tourShiftForm: { id: 'tour-form-1' },
  globalShiftForm: { id: 'global-form-1' },
  setDialogOpen: vi.fn(),
  setGlobalDialogOpen: vi.fn(),
  setDialogMode: vi.fn(),
  setGlobalDialogMode: vi.fn(),
  setTourShiftForm: vi.fn(),
  setGlobalShiftForm: vi.fn(),
  resetTourShiftForm: vi.fn(),
  resetGlobalShiftForm: vi.fn(),
  setMessage: vi.fn(),
  setLastOutcome: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/use-waste-scheduling-view-model.js', () => ({
  useWasteSchedulingViewModel: () => controllerMock,
}));

vi.mock('../src/waste-management.scheduling-panel.views.js', () => ({
  WasteSchedulingCreateFormView: () => <div>create-form</div>,
  WasteSchedulingDialogs: () => <div>dialogs</div>,
  WasteSchedulingGlobalFormView: () => <div>global-form</div>,
  WasteSchedulingHolidayFormView: () => <div>holiday-form</div>,
  WasteSchedulingListView: () => <div>list</div>,
  WasteSchedulingTourFormView: () => <div>tour-form</div>,
}));

describe('WasteSchedulingPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    controllerMock.setDialogOpen.mockReset();
    controllerMock.setGlobalDialogOpen.mockReset();
    controllerMock.setDialogMode.mockReset();
    controllerMock.setGlobalDialogMode.mockReset();
    controllerMock.setTourShiftForm.mockReset();
    controllerMock.setGlobalShiftForm.mockReset();
    controllerMock.resetTourShiftForm.mockReset();
    controllerMock.resetGlobalShiftForm.mockReset();
    controllerMock.setMessage.mockReset();
    controllerMock.setLastOutcome.mockReset();
    controllerMock.loading = false;
    controllerMock.error = null;
    controllerMock.lastOutcome = 'create-success';
    controllerMock.overview = null;
    controllerMock.tourShiftForm = { id: 'tour-form-1' };
    controllerMock.globalShiftForm = { id: 'global-form-1' };
  });

  it('clears the stale outcome after redirecting a successful scheduling form view back to the list', () => {
    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'create',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'tour-shift',
          schedulingEntryId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(controllerMock.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controllerMock.setGlobalDialogOpen).toHaveBeenCalledWith(false);
    expect(controllerMock.resetTourShiftForm).toHaveBeenCalled();
    expect(controllerMock.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        schedulingView: 'list',
        schedulingEntryType: undefined,
        schedulingEntryId: undefined,
      }),
      replace: true,
    });
  });

  it('hydrates the tour shift edit form from the route shift id after a reload', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      globalDateShifts: [],
      holidayRules: [],
      tourDateShifts: [
        {
          id: 'tour-shift-99',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          description: 'Vorverlegt',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };
    controllerMock.tourShiftForm = { id: 'stale-tour-shift' };

    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'edit',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'tour-shift',
          schedulingEntryId: 'tour-shift-99',
          tourDateShiftId: 'tour-shift-99',
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(controllerMock.setDialogMode).toHaveBeenCalledWith('edit');
    expect(controllerMock.setTourShiftForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tour-shift-99',
        tourId: 'tour-1',
        originalDate: '2026-12-24',
      })
    );
  });

  it('renders the dedicated create form view for the combined scheduling creation route', () => {
    controllerMock.lastOutcome = null;

    const view = render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'create',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'tour',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'tour-shift',
          schedulingEntryId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(view.getAllByText('create-form').length).toBeGreaterThan(0);
  });

  it('navigates back to the list when the shared edit route misses the entry id', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = { holidayRules: [], globalDateShifts: [], tourDateShifts: [] };

    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'edit',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'global-shift',
          schedulingEntryId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        schedulingView: 'list',
        schedulingEntryType: undefined,
        schedulingEntryId: undefined,
      }),
      replace: true,
    });
    expect(controllerMock.setGlobalDialogMode).not.toHaveBeenCalled();
    expect(controllerMock.setGlobalShiftForm).not.toHaveBeenCalled();
  });

  it('waits for the scheduling overview before evaluating a deep-linked edit route', () => {
    controllerMock.lastOutcome = null;
    controllerMock.loading = true;
    controllerMock.overview = null;

    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'edit',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'tour-shift',
          schedulingEntryId: 'tour-shift-99',
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(navigateMock).not.toHaveBeenCalled();
    expect(controllerMock.setDialogMode).not.toHaveBeenCalled();
    expect(controllerMock.setTourShiftForm).not.toHaveBeenCalled();
  });

  it('hydrates the global shift edit form from the route entry id after a reload', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      globalDateShifts: [
        {
          id: 'global-shift-7',
          originalDate: '2026-12-31',
          actualDate: '2027-01-02',
          hasYear: true,
          description: 'Nachgeholt',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      holidayRules: [],
      tourDateShifts: [],
    };
    controllerMock.globalShiftForm = { id: 'stale-global-shift' };

    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'edit',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'global-shift',
          schedulingEntryId: 'global-shift-7',
          tourDateShiftId: undefined,
          globalDateShiftId: 'global-shift-7',
        }}
      />
    );

    expect(controllerMock.setGlobalDialogMode).toHaveBeenCalledWith('edit');
    expect(controllerMock.setGlobalShiftForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'global-shift-7',
        originalDate: '2026-12-31',
        actualDate: '2027-01-02',
      })
    );
  });

  it('keeps a valid holiday-rule edit route intact once the overview is loaded', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      globalDateShifts: [],
      holidayRules: [
        {
          id: 'holiday-rule-1',
          holidayDate: '2026-12-25',
          holidayName: 'Weihnachten',
          year: 2026,
          stateCode: 'BY',
          sourceStatus: 'configured',
          configurationStatus: 'configured',
          conflictStatus: 'none',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      tourDateShifts: [],
    };

    render(
      <WasteSchedulingPanel
        search={{
          tab: 'scheduling',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'edit',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'holiday',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          schedulingEntryType: 'holiday-rule',
          schedulingEntryId: 'holiday-rule-1',
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
