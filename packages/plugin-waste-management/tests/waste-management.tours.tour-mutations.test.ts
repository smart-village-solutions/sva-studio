import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteToursTourMutationHandlers } from '../src/waste-management.tours.tour-mutations.js';

const apiMocks = vi.hoisted(() => ({
  appendWasteManagementDebugLog: vi.fn(),
  createWasteManagementTour: vi.fn(),
  updateWasteManagementTour: vi.fn(),
  deleteWasteManagementTour: vi.fn(),
  createWasteManagementLocationTourPickupDate: vi.fn(),
  updateWasteManagementLocationTourPickupDate: vi.fn(),
  deleteWasteManagementLocationTourPickupDate: vi.fn(),
}));

vi.mock('../src/waste-management.api.js', () => apiMocks);

vi.mock('../src/waste-management.page.support.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.page.support.js')>(
    '../src/waste-management.page.support.js'
  );

  return {
    ...actual,
    resolveApiErrorCode: () => null,
  };
});

const pt = (key: string) => key;

const createState = () =>
  ({
    dialogMode: 'edit' as const,
    tourForm: {
      id: 'tour-1',
      name: 'Schadstoffmobil',
      description: '',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'custom' as const,
      customRecurrenceId: '',
      firstDate: '',
      endDate: '',
      customDates: [{ date: '2027-01-01' }, { date: '2027-01-02' }],
      dateLocationAssignments: [
        {
          id: 'pickup-existing',
          pickupDate: '2027-01-01',
          locationId: 'location-1',
          note: '09:00 bis 10:00 Uhr',
        },
        {
          id: 'pickup-new',
          pickupDate: '2027-01-02',
          locationId: 'location-2',
          note: '11:00 bis 12:00 Uhr',
        },
      ],
      active: true,
    },
    schedulingOverview: {
      locationTourPickupDates: [
        {
          id: 'pickup-existing',
          tourId: 'tour-1',
          locationId: 'location-1',
          pickupDate: '2027-01-01',
          note: 'alt',
        },
        {
          id: 'pickup-deleted',
          tourId: 'tour-1',
          locationId: 'location-3',
          pickupDate: '2027-01-03',
          note: 'weg',
        },
      ],
    },
    setSaving: vi.fn(),
    setMessage: vi.fn(),
    setLastOutcome: vi.fn(),
    setDialogOpen: vi.fn(),
  }) as never;

describe('createWasteToursTourMutationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles pickup-date assignments after updating a tour', async () => {
    const state = createState();
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.updateWasteManagementTour.mockResolvedValue({});
    apiMocks.createWasteManagementLocationTourPickupDate.mockResolvedValue({});
    apiMocks.updateWasteManagementLocationTourPickupDate.mockResolvedValue({});
    apiMocks.deleteWasteManagementLocationTourPickupDate.mockResolvedValue({});

    const mutations = createWasteToursTourMutationHandlers({ state, pt, loadOverview });

    await mutations.onSubmitTour({ preventDefault: vi.fn() } as never, 'edit');

    expect(apiMocks.updateWasteManagementTour).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({
        name: 'Schadstoffmobil',
        customDates: [{ date: '2027-01-01', description: undefined }, { date: '2027-01-02', description: undefined }],
      })
    );
    expect(apiMocks.updateWasteManagementLocationTourPickupDate).toHaveBeenCalledWith('pickup-existing', {
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2027-01-01',
      note: '09:00 bis 10:00 Uhr',
    });
    expect(apiMocks.createWasteManagementLocationTourPickupDate).toHaveBeenCalledWith({
      id: 'pickup-new',
      locationId: 'location-2',
      tourId: 'tour-1',
      pickupDate: '2027-01-02',
      note: '11:00 bis 12:00 Uhr',
    });
    expect(apiMocks.deleteWasteManagementLocationTourPickupDate).toHaveBeenCalledWith('pickup-deleted');
    expect(loadOverview).toHaveBeenCalledWith(true);
  });

  it('drops stale custom-date assignments when a tour is switched to a recurring schedule', async () => {
    const state = createState();
    state.tourForm = {
      ...state.tourForm,
      recurrence: 'weekly',
      customDates: [],
    };
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.updateWasteManagementTour.mockResolvedValue({});
    apiMocks.createWasteManagementLocationTourPickupDate.mockResolvedValue({});
    apiMocks.updateWasteManagementLocationTourPickupDate.mockResolvedValue({});
    apiMocks.deleteWasteManagementLocationTourPickupDate.mockResolvedValue({});

    const mutations = createWasteToursTourMutationHandlers({ state, pt, loadOverview });

    await mutations.onSubmitTour({ preventDefault: vi.fn() } as never, 'edit');

    expect(apiMocks.updateWasteManagementTour).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({
        recurrence: 'weekly',
        customDates: undefined,
      })
    );
    expect(apiMocks.createWasteManagementLocationTourPickupDate).not.toHaveBeenCalled();
    expect(apiMocks.updateWasteManagementLocationTourPickupDate).not.toHaveBeenCalled();
    expect(apiMocks.deleteWasteManagementLocationTourPickupDate).toHaveBeenCalledTimes(2);
    expect(apiMocks.deleteWasteManagementLocationTourPickupDate).toHaveBeenCalledWith('pickup-existing');
    expect(apiMocks.deleteWasteManagementLocationTourPickupDate).toHaveBeenCalledWith('pickup-deleted');
  });

  it('blocks saving when an assignment misses location or note', async () => {
    const state = createState();
    state.tourForm = {
      ...state.tourForm,
      dateLocationAssignments: [
        {
          id: 'broken',
          pickupDate: '2027-01-01',
          locationId: '',
          note: '',
        },
      ],
    };

    const mutations = createWasteToursTourMutationHandlers({
      state,
      pt,
      loadOverview: vi.fn(),
    });

    await mutations.onSubmitTour({ preventDefault: vi.fn() } as never, 'edit');

    expect(apiMocks.updateWasteManagementTour).not.toHaveBeenCalled();
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'tours.messages.assignmentIncomplete',
    });
  });

  it('creates a tour, forwards duplicate source ids, and reports success', async () => {
    const state = createState();
    state.dialogMode = 'create';
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.createWasteManagementTour.mockResolvedValue({});

    const mutations = createWasteToursTourMutationHandlers({ state, pt, loadOverview });

    await mutations.onSubmitTour({ preventDefault: vi.fn() } as never, 'create', 'tour-source-1');

    expect(apiMocks.createWasteManagementTour).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateFromTourId: 'tour-source-1',
      })
    );
    expect(state.setDialogOpen).toHaveBeenCalledWith(false);
    expect(state.setLastOutcome).toHaveBeenCalledWith('create-success');
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tours.messages.createSuccess',
    });
  });

  it('updates tour status and reports delete success for single-tour deletion', async () => {
    const state = createState();
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.updateWasteManagementTour.mockResolvedValue({});
    apiMocks.deleteWasteManagementTour.mockResolvedValue({});

    const mutations = createWasteToursTourMutationHandlers({ state, pt, loadOverview });

    await mutations.onToggleTourStatus(
      {
        id: 'tour-1',
        name: 'Restmüll',
        wasteFractionIds: [],
        active: true,
        recurrence: 'custom',
        customDates: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as never,
      false
    );
    await mutations.onDeleteTour({ id: 'tour-1' } as never);

    expect(apiMocks.updateWasteManagementTour).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({ active: false })
    );
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tours.messages.updateSuccess',
    });
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tours.messages.deleteSuccess',
    });
  });

  it('reports partial bulk delete success and maps delete failures', async () => {
    const partialState = createState();
    const partialLoadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.deleteWasteManagementTour.mockReset();
    apiMocks.deleteWasteManagementTour.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('forbidden'));

    const partialMutations = createWasteToursTourMutationHandlers({
      state: partialState,
      pt,
      loadOverview: partialLoadOverview,
    });

    await partialMutations.onDeleteTours(['tour-1', 'tour-2']);

    expect(partialState.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tours.messages.deletePartialSuccess',
    });

    const errorState = createState();
    const errorMutations = createWasteToursTourMutationHandlers({
      state: errorState,
      pt,
      loadOverview: vi.fn().mockResolvedValue(undefined),
    });
    apiMocks.deleteWasteManagementTour.mockReset();
    apiMocks.deleteWasteManagementTour.mockRejectedValueOnce(new Error('invalid_request'));

    await errorMutations.onDeleteTour({ id: 'tour-5' } as never);

    expect(errorState.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'tours.messages.deleteError',
    });
  });

  it('reports full bulk delete success and keeps the overview refresh when all deletions succeed', async () => {
    const state = createState();
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    apiMocks.deleteWasteManagementTour.mockReset();
    apiMocks.deleteWasteManagementTour.mockResolvedValue({});

    const mutations = createWasteToursTourMutationHandlers({
      state,
      pt,
      loadOverview,
    });

    await mutations.onDeleteTours(['tour-1', 'tour-2']);

    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'tours.messages.deleteSuccess',
    });
  });

  it('maps bulk delete failures and outer delete errors through the shared delete error helper', async () => {
    const failedState = createState();
    const failedMutations = createWasteToursTourMutationHandlers({
      state: failedState,
      pt,
      loadOverview: vi.fn().mockResolvedValue(undefined),
    });
    const failedAllSettledSpy = vi.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
      { status: 'rejected', reason: new Error('forbidden') },
      { status: 'rejected', reason: new Error('forbidden') },
    ] as PromiseSettledResult<unknown>[]);

    await failedMutations.onDeleteTours(['tour-1', 'tour-2']);

    expect(failedState.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'tours.messages.deleteError',
    });
    failedAllSettledSpy.mockRestore();

    const outerErrorState = createState();
    const outerErrorMutations = createWasteToursTourMutationHandlers({
      state: outerErrorState,
      pt,
      loadOverview: vi.fn().mockResolvedValue(undefined),
    });
    const allSettledSpy = vi.spyOn(Promise, 'allSettled').mockRejectedValueOnce(new Error('boom'));

    await outerErrorMutations.onDeleteTours(['tour-3']);

    expect(outerErrorState.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'tours.messages.deleteError',
    });

    allSettledSpy.mockRestore();
  });
});
