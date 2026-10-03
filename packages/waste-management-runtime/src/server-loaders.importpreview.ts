import { previewWasteLocationTourPickupDateImport as buildWasteLocationTourPickupDateImportPreview } from './repositories.js';
import type { WasteLoaderContext } from './server-loaders.context.js';
import type { WasteServerLoaderHost } from './server-loaders.js';

export const createImportPreview = (context: WasteLoaderContext, host: WasteServerLoaderHost) => {
  const { withWasteRepository, measureWasteStep } = context;
  const { readPluginOperationInput } = host;
  const previewWasteLocationTourPickupDateImport = (input: {
    readonly instanceId: string;
    readonly sourceFormat:
      'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    readonly blobRef: string;
    readonly delimiterOverride?: ';' | ',' | '\t' | '|';
  }) =>
    withWasteRepository(
      input.instanceId,
      'preview_location_tour_pickup_date_import',
      async (repository) =>
        measureWasteStep(
          'preview_location_tour_pickup_date_import',
          'simulate_import',
          { instance_id: input.instanceId },
          async () =>
            buildWasteLocationTourPickupDateImportPreview(
              repository,
              {
                instanceId: input.instanceId,
                sourceFormat: input.sourceFormat,
                blobRef: input.blobRef,
                delimiterOverride: input.delimiterOverride,
              },
              readPluginOperationInput
            )
        )
    );

  return { previewWasteLocationTourPickupDateImport };
};
