import type {
  WasteLocationTourLinkRecord,
  WasteLocationTourPickupDateRecord,
  WasteTourAssignmentRecord,
} from '@sva/waste-management-contracts';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteEntitiesTourLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  get loadWasteLocationTourLinkById() {
    return this.context.createLoader(
      'load_waste_location_tour_link_by_id',
      (repository, linkId: string) => repository.getWasteLocationTourLinkById(linkId)
    );
  }
  get listWasteLocationTourLinksByTourId() {
    return this.context.createLoader(
      'list_waste_location_tour_links_by_tour_id',
      (repository, tourId: string) => repository.listWasteLocationTourLinksByTourId(tourId)
    );
  }
  get saveWasteLocationTourLink() {
    return this.context.createLoader(
      'save_waste_location_tour_link',
      (repository, input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteLocationTourLink(input)
    );
  }
  get deleteWasteLocationTourLink() {
    return this.context.createLoader(
      'delete_waste_location_tour_link',
      (repository, linkId: string) => repository.deleteWasteLocationTourLink(linkId)
    );
  }
  get loadWasteLocationTourPickupDateById() {
    return this.context.createLoader(
      'load_waste_location_tour_pickup_date_by_id',
      (repository, pickupDateId: string) =>
        repository.getWasteLocationTourPickupDateById(pickupDateId)
    );
  }
  get listWasteLocationTourPickupDates() {
    return this.context.createLoader(
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
  }
  get saveWasteLocationTourPickupDate() {
    return this.context.createLoader(
      'save_waste_location_tour_pickup_date',
      (repository, input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteLocationTourPickupDate(input)
    );
  }
  get deleteWasteLocationTourPickupDate() {
    return this.context.createLoader(
      'delete_waste_location_tour_pickup_date',
      (repository, pickupDateId: string) =>
        repository.deleteWasteLocationTourPickupDate(pickupDateId)
    );
  }
  get loadWasteTourAssignmentById() {
    return this.context.createLoader(
      'load_waste_tour_assignment_by_id',
      (repository, assignmentId: string) => repository.getWasteTourAssignmentById(assignmentId)
    );
  }
  get listWasteTourAssignments() {
    return this.context.createLoader(
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
  }
  get saveWasteTourAssignment() {
    return this.context.createLoader(
      'save_waste_tour_assignment',
      (repository, input: Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>) =>
        repository.upsertWasteTourAssignment(input)
    );
  }
  get deleteWasteTourAssignment() {
    return this.context.createLoader(
      'delete_waste_tour_assignment',
      (repository, assignmentId: string) => repository.deleteWasteTourAssignment(assignmentId)
    );
  }
  get loadWasteCustomRecurrencePresets() {
    return this.context.createLoader('load_waste_custom_recurrence_presets', (repository) =>
      repository.listWasteCustomRecurrencePresets()
    );
  }
  get loadWastePdfStaticSettings() {
    return this.context.createLoader('load_waste_pdf_static_settings', (repository) =>
      repository.getWastePdfStaticSettings()
    );
  }
  get loadWasteHolidayRuleById() {
    return this.context.createLoader(
      'load_waste_holiday_rule_by_id',
      async (repository, ruleId: string) => {
        const rules = await repository.listWasteHolidayRules();
        return rules.find((rule) => rule.id === ruleId) ?? null;
      }
    );
  }
}
