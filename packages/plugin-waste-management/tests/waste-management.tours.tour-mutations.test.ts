import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWasteToursTourMutationHandlers } from '../src/waste-management.tours.tour-mutations.js';

const apiMocks = vi.hoisted(() => ({
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
});
