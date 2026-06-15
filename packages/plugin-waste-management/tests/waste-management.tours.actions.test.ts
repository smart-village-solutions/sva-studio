import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteToursActions } from '../src/waste-management.tours.actions.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementSchedulingOverview: vi.fn(),
}));

vi.mock('../src/waste-management.api.js', () => apiMocks);

describe('createWasteToursActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens create and edit flows, including existing assignment links', async () => {
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({ locationTourPickupDates: [] });
    const state = {
      schedulingOverview: { locationTourPickupDates: [] },
      masterDataOverview: {
        locationTourLinks: [
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
            endDate: '2026-06-01',
            createdAt: '2026-05-01T10:00:00.000Z',
            updatedAt: '2026-05-01T10:00:00.000Z',
          },
        ],
      },
      setDialogMode: vi.fn(),
      setTourForm: vi.fn(),
      setMessage: vi.fn(),
      setDialogOpen: vi.fn(),
      setSelectedTour: vi.fn(),
      setAssignmentsDialogMode: vi.fn(),
      setLinkForm: vi.fn(),
      setAssignmentsDialogOpen: vi.fn(),
      setSchedulingOverview: vi.fn(),
      setCalendarOpen: vi.fn(),
    };
    const actions = createWasteToursActions(state as never);
    const tour = {
      id: 'tour-1',
      name: 'Tour A',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'custom',
      customDates: [{ date: '2026-08-18' }],
      active: true,
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    };

    actions.openCreateDialog();
    actions.openEditDialog(tour as never);
    actions.openCreateAssignmentsDialog(tour as never);
    actions.openEditAssignmentsDialog(tour as never, 'missing-link');
    actions.openEditAssignmentsDialog(tour as never, 'link-1');
    await actions.openCalendar(tour as never);
    actions.resetTourForm();
    actions.resetLinkForm();

    expect(state.setDialogMode).toHaveBeenCalledWith('create');
    expect(state.setDialogMode).toHaveBeenCalledWith('edit');
    expect(state.setDialogOpen).toHaveBeenCalledTimes(2);
    expect(state.setSelectedTour).toHaveBeenCalledWith(tour);
    expect(state.setAssignmentsDialogMode).toHaveBeenCalledWith('create');
    expect(state.setAssignmentsDialogMode).toHaveBeenCalledWith('edit');
    expect(state.setAssignmentsDialogOpen).toHaveBeenCalledTimes(3);
    expect(state.setLinkForm).toHaveBeenCalledWith(expect.objectContaining({ tourId: 'tour-1' }));
    expect(state.setLinkForm).toHaveBeenCalledWith({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-06-01',
    });
    expect(state.setSchedulingOverview).toHaveBeenCalledWith({ locationTourPickupDates: [] });
    expect(state.setCalendarOpen).toHaveBeenCalledWith(true);
  });

  it('falls back to null scheduling overview when calendar loading fails', async () => {
    apiMocks.getWasteManagementSchedulingOverview.mockRejectedValue(new Error('boom'));
    const state = {
      schedulingOverview: null,
      masterDataOverview: null,
      setDialogMode: vi.fn(),
      setTourForm: vi.fn(),
      setMessage: vi.fn(),
      setDialogOpen: vi.fn(),
      setSelectedTour: vi.fn(),
      setAssignmentsDialogMode: vi.fn(),
      setLinkForm: vi.fn(),
      setAssignmentsDialogOpen: vi.fn(),
      setSchedulingOverview: vi.fn(),
      setCalendarOpen: vi.fn(),
    };
    const actions = createWasteToursActions(state as never);
    const tour = {
      id: 'tour-2',
      name: 'Tour B',
      wasteFractionIds: [],
      recurrence: 'custom',
      active: true,
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    };

    await actions.openCalendar(tour as never);

    expect(state.setSelectedTour).toHaveBeenCalledWith(tour);
    expect(state.setSchedulingOverview).toHaveBeenCalledWith(null);
    expect(state.setCalendarOpen).toHaveBeenCalledWith(true);
  });
});
