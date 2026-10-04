import {
  isWasteTourValidityApplicable,
  resolveWasteTourValidityDates,
} from '@sva/waste-management-contracts';
import type {
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourLinkRecord,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityBulkUpdateResult,
  WasteTourStatusBulkUpdateInput,
  WasteTourStatusBulkUpdateResult,
} from '@sva/waste-management-contracts';
import { createWasteMasterDataRepository } from './repositories/master-data.js';
import type { WasteLoaderContext } from './server-loaders.context.js';

export class WasteBulkLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  saveWasteLocationTourLinksBulk = async (
    instanceId: string,
    input: WasteLocationTourLinkBulkCreateInput
  ): Promise<readonly WasteLocationTourLinkRecord[]> => {
    return this.context.withWasteClient(
      instanceId,
      'save_waste_location_tour_links_bulk',
      async (client) => {
        try {
          await client.query('BEGIN');
          const repository = createWasteMasterDataRepository(
            this.context.createSqlExecutor(client)
          );
          const createdItems: WasteLocationTourLinkRecord[] = [];
          for (const locationId of input.locationIds) {
            const id = crypto.randomUUID();
            await repository.upsertWasteLocationTourLink({
              id,
              locationId,
              tourId: input.tourId,
            });

            const saved = await repository.getWasteLocationTourLinkById(id);
            if (!saved) {
              throw new Error(`bulk_location_tour_link_verification_failed:${id}`);
            }
            createdItems.push(saved);
          }
          await client.query('COMMIT');
          return createdItems;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    );
  };

  updateWasteTourValidityBulk = async (
    instanceId: string,
    input: WasteTourValidityBulkUpdateInput
  ): Promise<WasteTourValidityBulkUpdateResult> =>
    this.context.withWasteClient(instanceId, 'update_waste_tour_validity_bulk', async (client) => {
      try {
        await client.query('BEGIN');
        const repository = createWasteMasterDataRepository(this.context.createSqlExecutor(client));
        const tours = await repository.lockWasteToursByIds(input.tourIds);
        const toursById = new Map(tours.map((tour) => [tour.id, tour] as const));
        const missingTourId = input.tourIds.find((tourId) => !toursById.has(tourId));
        if (missingTourId) {
          throw new Error(`bulk_tour_validity_not_found:${missingTourId}`);
        }
        if (input.firstDate.mode === 'clear') {
          throw new Error(
            `bulk_tour_validity_first_date_required:${input.tourIds[0] ?? 'unknown'}`
          );
        }

        for (const tourId of input.tourIds) {
          const tour = toursById.get(tourId);
          if (!tour) {
            throw new Error(`bulk_tour_validity_not_found:${tourId}`);
          }
          if (!isWasteTourValidityApplicable(tour)) {
            throw new Error(`bulk_tour_validity_not_applicable:${tourId}`);
          }
          if (!resolveWasteTourValidityDates(tour, input)) {
            throw new Error(`bulk_tour_validity_invalid_range:${tourId}`);
          }
        }

        const updatedCount = await repository.updateWasteTourValidityBulk(input);
        if (updatedCount !== input.tourIds.length) {
          throw new Error(`bulk_tour_validity_verification_failed:${updatedCount}`);
        }

        await client.query('COMMIT');
        return { updatedCount };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

  updateWasteTourStatusBulk = async (
    instanceId: string,
    input: WasteTourStatusBulkUpdateInput
  ): Promise<WasteTourStatusBulkUpdateResult> =>
    this.context.withWasteClient(instanceId, 'update_waste_tour_status_bulk', async (client) => {
      try {
        await client.query('BEGIN');
        const repository = createWasteMasterDataRepository(this.context.createSqlExecutor(client));
        const tours = await repository.lockWasteToursByIds(input.tourIds);
        const existingTourIds = new Set(tours.map((tour) => tour.id));
        const missingTourId = input.tourIds.find((tourId) => !existingTourIds.has(tourId));
        if (missingTourId) {
          throw new Error(`bulk_tour_status_not_found:${missingTourId}`);
        }

        const updatedCount = await repository.updateWasteTourStatusBulk(input);
        if (updatedCount !== input.tourIds.length) {
          throw new Error(`bulk_tour_status_verification_failed:${updatedCount}`);
        }

        await client.query('COMMIT');
        return { updatedCount };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
}
