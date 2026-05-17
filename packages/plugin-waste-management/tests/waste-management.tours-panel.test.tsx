import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursPanel } from '../src/waste-management.tours-panel.js';

const navigateMock = vi.fn();
const controllerMock = vi.hoisted(() => ({
  loading: false,
  error: null,
  lastOutcome: 'create-success' as const,
  overview: null as null | { tours: readonly { id: string; name: string; wasteFractionIds: readonly string[]; active: boolean; createdAt: string; updatedAt: string; description?: string | null; recurrence?: string | null; firstDate?: string | null; endDate?: string | null; customDates?: readonly { date: string; description?: string | null }[] | null }[] },
  tourForm: { id: 'tour-form-1' },
  setDialogOpen: vi.fn(),
  setDialogMode: vi.fn(),
  resetTourForm: vi.fn(),
  setTourForm: vi.fn(),
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
    controllerMock.setDialogMode.mockReset();
    controllerMock.resetTourForm.mockReset();
    controllerMock.setTourForm.mockReset();
    controllerMock.setLastOutcome.mockReset();
    controllerMock.loading = false;
    controllerMock.error = null;
    controllerMock.lastOutcome = 'create-success';
    controllerMock.overview = null;
    controllerMock.tourForm = { id: 'tour-form-1' };
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
      search: expect.objectContaining({ toursView: 'list', tourId: undefined }),
      replace: true,
    });
  });

  it('hydrates the edit form from the route tour id after a reload', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      tours: [
        {
          id: 'tour-99',
          name: 'Tour 99',
          wasteFractionIds: [],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };
    controllerMock.tourForm = { id: 'stale-form-id' };

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
          tourId: 'tour-99',
        }}
      />
    );

    expect(controllerMock.setDialogMode).toHaveBeenCalledWith('edit');
    expect(controllerMock.setTourForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tour-99',
        name: 'Tour 99',
      })
    );
  });

  it('keeps the edit mode explicit even when the form already targets the route tour id', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      tours: [
        {
          id: 'tour-99',
          name: 'Tour 99',
          wasteFractionIds: [],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };
    controllerMock.tourForm = { id: 'tour-99' };

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
          tourId: 'tour-99',
        }}
      />
    );

    expect(controllerMock.setDialogMode).toHaveBeenCalledWith('edit');
    expect(controllerMock.setTourForm).not.toHaveBeenCalled();
  });

  it('navigates back to the list when the route tour id no longer exists', () => {
    controllerMock.lastOutcome = null;
    controllerMock.overview = {
      tours: [
        {
          id: 'tour-99',
          name: 'Tour 99',
          wasteFractionIds: [],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };

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
          tourId: 'tour-missing',
        }}
      />
    );

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'list', tourId: undefined }),
      replace: true,
    });
    expect(controllerMock.setDialogMode).not.toHaveBeenCalled();
    expect(controllerMock.setTourForm).not.toHaveBeenCalled();
  });
});
