import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingPanel } from '../src/waste-management.scheduling-panel.js';

const navigateMock = vi.fn();
const controllerMock = vi.hoisted(() => ({
  loading: false,
  error: null,
  lastOutcome: 'create-tour-success' as const,
  setDialogOpen: vi.fn(),
  setGlobalDialogOpen: vi.fn(),
  resetTourShiftForm: vi.fn(),
  resetGlobalShiftForm: vi.fn(),
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
    controllerMock.resetTourShiftForm.mockReset();
    controllerMock.resetGlobalShiftForm.mockReset();
    controllerMock.setLastOutcome.mockReset();
    controllerMock.loading = false;
    controllerMock.error = null;
    controllerMock.lastOutcome = 'create-tour-success';
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
        }}
      />
    );

    expect(controllerMock.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controllerMock.setGlobalDialogOpen).toHaveBeenCalledWith(false);
    expect(controllerMock.resetTourShiftForm).toHaveBeenCalled();
    expect(controllerMock.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ schedulingView: 'list' }),
      replace: true,
    });
  });
});
