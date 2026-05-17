import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursPanel } from '../src/waste-management.tours-panel.js';

const navigateMock = vi.fn();
const controllerMock = vi.hoisted(() => ({
  loading: false,
  error: null,
  lastOutcome: 'create-success' as const,
  setDialogOpen: vi.fn(),
  resetTourForm: vi.fn(),
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

vi.mock('../src/waste-management.tours.controller.js', () => ({
  useWasteToursController: () => controllerMock,
}));

vi.mock('../src/waste-management.tours-dialogs-panel.js', () => ({
  WasteToursDialogs: () => <div>dialogs</div>,
}));

vi.mock('../src/waste-management.tours-panel.views.js', () => ({
  WasteToursFormView: () => <div>form</div>,
  WasteToursListView: () => <div>list</div>,
}));

describe('WasteToursPanel', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    controllerMock.setDialogOpen.mockReset();
    controllerMock.resetTourForm.mockReset();
    controllerMock.setLastOutcome.mockReset();
    controllerMock.loading = false;
    controllerMock.error = null;
    controllerMock.lastOutcome = 'create-success';
  });

  it('clears the stale outcome after redirecting a successful form view back to the list', () => {
    render(
      <WasteToursPanel
        search={{
          tab: 'tours',
          masterDataTab: 'fractions',
          fractionsView: 'list',
          toursView: 'edit',
          locationsView: 'list',
          schedulingView: 'list',
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
    expect(controllerMock.resetTourForm).toHaveBeenCalled();
    expect(controllerMock.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'list' }),
      replace: true,
    });
  });
});
