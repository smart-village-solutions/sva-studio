import type {
  WasteManagementToursOverview,
  WasteManagementSchedulingOverview,
} from '@sva/waste-management-contracts';
import type { WasteLoaderContext } from './server-loaders.context.js';

export const createScheduling = (context: WasteLoaderContext) => {
  const { withWasteRepository, measureWasteStep, measureWasteRepositoryStep } = context;
  const loadToursOverview = (instanceId: string): Promise<WasteManagementToursOverview> =>
    withWasteRepository(instanceId, 'load_tours_overview', async (repository) =>
      measureWasteStep(
        'load_tours_overview',
        'query_overview',
        { instance_id: instanceId },
        async () => ({
          tours: await repository.listWasteTours(),
          customRecurrencePresets: await repository.listWasteCustomRecurrencePresets(),
        })
      )
    );

  const loadSchedulingOverview = (instanceId: string): Promise<WasteManagementSchedulingOverview> =>
    withWasteRepository(instanceId, 'load_scheduling_overview', async (repository) =>
      measureWasteStep(
        'load_scheduling_overview',
        'query_overview',
        { instance_id: instanceId },
        async () => {
          const tourAssignments = await measureWasteRepositoryStep(
            instanceId,
            'load_scheduling_overview',
            'list_waste_tour_assignments',
            () => repository.listWasteTourAssignments()
          );
          const locationTourPickupDates = await measureWasteRepositoryStep(
            instanceId,
            'load_scheduling_overview',
            'list_waste_location_tour_pickup_dates',
            () => repository.listWasteLocationTourPickupDates()
          );
          const tourDateShifts = await measureWasteRepositoryStep(
            instanceId,
            'load_scheduling_overview',
            'list_waste_tour_date_shifts',
            () => repository.listWasteTourDateShifts()
          );
          const globalDateShifts = await measureWasteRepositoryStep(
            instanceId,
            'load_scheduling_overview',
            'list_waste_global_date_shifts',
            () => repository.listWasteGlobalDateShifts()
          );
          const holidayRules = await measureWasteRepositoryStep(
            instanceId,
            'load_scheduling_overview',
            'list_waste_holiday_rules',
            () => repository.listWasteHolidayRules()
          );
          return {
            tourAssignments,
            locationTourPickupDates,
            tourDateShifts,
            globalDateShifts,
            holidayRules,
          };
        }
      )
    );

  return { loadToursOverview, loadSchedulingOverview };
};
