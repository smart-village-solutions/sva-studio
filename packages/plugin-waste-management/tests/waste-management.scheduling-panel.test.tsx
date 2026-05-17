import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingPanel } from '../src/waste-management.scheduling-panel.js';

const navigateMock = vi.fn();
const controllerMock = vi.hoisted(() => ({
  loading: false,
  error: null,
  lastOutcome: 'create-tour-success' as const,
  overview: null as null | {
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

vi.mock('../src/waste-management.scheduling.controller.js', () => ({
  useWasteSchedulingController: () => controllerMock,
}));

vi.mock('../src/waste-management.scheduling-panel.views.js', () => ({
  WasteSchedulingDialogs: () => <div>dialogs</div>,
  WasteSchedulingGlobalFormView: () => <div>global-form</div>,
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
    controllerMock.lastOutcome = 'create-tour-success';
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
          schedulingView: 'create-tour',
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
        tourDateShiftId: undefined,
        globalDateShiftId: undefined,
      }),
      replace: true,
    });
  });

  it('hydrates the tour shift edit form from the route shift id after a reload', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      globalDateShifts: [],
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
          schedulingView: 'edit-tour',
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
});
