import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteToursActions } from '../src/waste-management.tours.actions.js';

describe('createWasteToursActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens create and edit flows, including existing assignment links', async () => {
    const refreshScheduling = vi.fn(async () => undefined);
    const state = {
      schedulingOverview: { locationTourPickupDates: [] },
      masterDataOverview: {
        locationTourLinks: [
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
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
      setCalendarOpen: vi.fn(),
    };
    const actions = createWasteToursActions(state as never, refreshScheduling);
    const tour = {
      id: 'tour-1',
      name: 'Tour A',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'custom',
      customDates: [{ date: '2026-08-18' }],
      status: 'published',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    };

    actions.openCreateDialog();
    actions.openEditDialog(tour as never);
    await actions.openCalendar(tour as never);
    actions.resetTourForm();

    expect(state.setDialogMode).toHaveBeenCalledWith('create');
    expect(state.setDialogMode).toHaveBeenCalledWith('edit');
    expect(state.setDialogOpen).toHaveBeenCalledTimes(2);
    expect(state.setSelectedTour).toHaveBeenCalledWith(tour);
    expect(refreshScheduling).toHaveBeenCalledOnce();
    expect(state.setCalendarOpen).toHaveBeenCalledWith(true);
  });

  it('opens immediately while the shared query refreshes', async () => {
    let finish!: (value: undefined) => void;
    const refreshScheduling = vi.fn(
      () =>
        new Promise<undefined>((resolve) => {
          finish = resolve;
        })
    );
    const state = {
      setSelectedTour: vi.fn(),
      setCalendarOpen: vi.fn(),
    };
    const action = createWasteToursActions(state as never, refreshScheduling).openCalendar({
      id: 'tour-2',
    } as never);

    expect(state.setSelectedTour).toHaveBeenCalledWith({ id: 'tour-2' });
    expect(state.setCalendarOpen).toHaveBeenCalledWith(true);
    expect(refreshScheduling).toHaveBeenCalledOnce();
    finish(undefined);
    await action;
  });
});
