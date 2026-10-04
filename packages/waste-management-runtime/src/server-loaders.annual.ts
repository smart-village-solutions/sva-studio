import {
  buildWasteAnnualTourTransferPreview,
  toWasteAnnualTourTransferPublicPreview,
} from '@sva/waste-management-contracts';
import type {
  WasteAnnualTourTransferCreateInput,
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/waste-management-contracts';
import {
  createWasteAnnualTourTransferInTransaction,
  loadWasteAnnualTourTransferSource,
} from './repositories.js';
import type { WasteLoaderContext } from './server-loaders.context.js';

export const createAnnual = (context: WasteLoaderContext) => {
  const { withWasteRepository, withWasteClient } = context;
  const previewWasteAnnualTourTransfer = async (input: {
    readonly instanceId: string;
    readonly sourceYear: number;
    readonly selectedTourIds?: readonly string[];
    readonly replacementDates?: WasteAnnualTourTransferCreateInput['replacementDates'];
  }): Promise<WasteAnnualTourTransferPreview> =>
    withWasteRepository(
      input.instanceId,
      'preview_waste_annual_tour_transfer',
      async (repository) => {
        const snapshot = await loadWasteAnnualTourTransferSource(repository);
        return toWasteAnnualTourTransferPublicPreview(
          await buildWasteAnnualTourTransferPreview({
            instanceId: input.instanceId,
            sourceYear: input.sourceYear,
            currentYear: new Date().getUTCFullYear(),
            source: snapshot,
            target: snapshot,
            selectedTourIds: input.selectedTourIds,
            replacementDates: input.replacementDates,
          })
        );
      }
    );

  const createWasteAnnualTourTransfer = async (input: {
    readonly instanceId: string;
    readonly create: WasteAnnualTourTransferCreateInput;
  }): Promise<WasteAnnualTourTransferResult> =>
    withWasteClient(input.instanceId, 'create_waste_annual_tour_transfer', async (client) =>
      createWasteAnnualTourTransferInTransaction({ ...input, client })
    );

  return { previewWasteAnnualTourTransfer, createWasteAnnualTourTransfer };
};
