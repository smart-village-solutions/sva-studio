import type {
  WasteLocationTourLinkRecord,
  WasteLocationTourPickupDateRecord,
  WasteTourAssignmentRecord,
} from '@sva/waste-management-contracts';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteEntitiesTourLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  loadWasteLocationTourLinkById = this.context.createLoader(
    'load_waste_location_tour_link_by_id',
    (repository, linkId: string) => repository.getWasteLocationTourLinkById(linkId)
  );
  listWasteLocationTourLinksByTourId = this.context.createLoader(
    'list_waste_location_tour_links_by_tour_id',
    (repository, tourId: string) => repository.listWasteLocationTourLinksByTourId(tourId)
  );
  saveWasteLocationTourLink = this.context.createLoader(
    'save_waste_location_tour_link',
    (repository, input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteLocationTourLink(input)
  );
  deleteWasteLocationTourLink = this.context.createLoader(
    'delete_waste_location_tour_link',
    (repository, linkId: string) => repository.deleteWasteLocationTourLink(linkId)
  );
  loadWasteLocationTourPickupDateById = this.context.createLoader(
    'load_waste_location_tour_pickup_date_by_id',
    (repository, pickupDateId: string) =>
      repository.getWasteLocationTourPickupDateById(pickupDateId)
  );
  listWasteLocationTourPickupDates = this.context.createLoader(
    'list_waste_location_tour_pickup_dates',
    (
      repository,
      filter?: {
        readonly locationId?: string;
        readonly tourId?: string;
        readonly pickupDate?: string;
      }
    ) => repository.listWasteLocationTourPickupDates(filter)
  );
  saveWasteLocationTourPickupDate = this.context.createLoader(
    'save_waste_location_tour_pickup_date',
    (repository, input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteLocationTourPickupDate(input)
  );
  deleteWasteLocationTourPickupDate = this.context.createLoader(
    'delete_waste_location_tour_pickup_date',
    (repository, pickupDateId: string) => repository.deleteWasteLocationTourPickupDate(pickupDateId)
  );
  loadWasteTourAssignmentById = this.context.createLoader(
    'load_waste_tour_assignment_by_id',
    (repository, assignmentId: string) => repository.getWasteTourAssignmentById(assignmentId)
  );
  listWasteTourAssignments = this.context.createLoader(
    'list_waste_tour_assignments',
    (
      repository,
      filter?: {
        readonly tourId?: string;
        readonly pickupDate?: string;
        readonly locationIds?: readonly string[];
      }
    ) => repository.listWasteTourAssignments(filter)
  );
  saveWasteTourAssignment = this.context.createLoader(
    'save_waste_tour_assignment',
    (repository, input: Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteTourAssignment(input)
  );
  deleteWasteTourAssignment = this.context.createLoader(
    'delete_waste_tour_assignment',
    (repository, assignmentId: string) => repository.deleteWasteTourAssignment(assignmentId)
  );
  loadWasteCustomRecurrencePresets = this.context.createLoader(
    'load_waste_custom_recurrence_presets',
    (repository) => repository.listWasteCustomRecurrencePresets()
  );
  loadWastePdfStaticSettings = this.context.createLoader(
    'load_waste_pdf_static_settings',
    (repository) => repository.getWastePdfStaticSettings()
  );
  loadWasteHolidayRuleById = this.context.createLoader(
    'load_waste_holiday_rule_by_id',
    async (repository, ruleId: string) => {
      const rules = await repository.listWasteHolidayRules();
      return rules.find((rule) => rule.id === ruleId) ?? null;
    }
  );
}
