import type {
  SvaMainserverConnectionInput,
  SvaMainserverOwnershipTransferInput,
  SvaMainserverPoiInput,
  SvaMainserverStaticContentInput,
} from '../../types.js';
import {
  svaMainserverChangeNewsVisibilityDocument,
  type SvaMainserverChangeNewsVisibilityMutation,
} from '../../generated/news-visibility.js';
import { mergePoiUpdateWithCurrent } from './editor-field-matrices.js';
import type { ServiceContext } from './service-context.js';
import { toSvaMainserverError, withUpdatedPayload } from './shared.js';

export const createPoiService = ({
  loadValidatedInstanceConfig,
  executeGraphqlWithConfig,
  poiOperations,
  genericItemOperations,
  transferContentOwnershipWithConfig,
  staticContentOperations,
}: ServiceContext) => {
  const getPoi = async (input: SvaMainserverConnectionInput & { readonly poiId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.getPoiWithConfig(input, config);
  };

  const getPoiDetail = async (input: SvaMainserverConnectionInput & { readonly poiId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.getPoiDetailWithConfig(input, config);
  };

  const createPoi = async (
    input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.writePoiWithConfig(input, config);
  };

  const updatePoi = async (
    input: SvaMainserverConnectionInput & {
      readonly poiId: string;
      readonly poi: SvaMainserverPoiInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const current = await poiOperations.getPoiDetailWithConfig(input, config);
    // Mainserver replaces lunches on a POI write, even when the field is omitted.
    // Never turn an absent or malformed server read into an empty relation.
    if (
      !current.data.lunches ||
      current.deviations.some(({ fieldGroup }) => fieldGroup === 'lunches')
    ) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'poi_lunch_snapshot_incomplete',
        statusCode: 502,
      });
    }
    return poiOperations.writePoiWithConfig(
      {
        ...input,
        poi: {
          ...mergePoiUpdateWithCurrent(current.data, input.poi, current.deviations),
          payload: withUpdatedPayload(input.poi.payload, current.data.payload),
          lunches: current.data.lunches,
        },
        forceCreate: true,
      },
      config
    );
  };

  const changePoiVisibility = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string; readonly visible: boolean }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeGraphqlWithConfig<SvaMainserverChangeNewsVisibilityMutation>(
      {
        ...input,
        document: svaMainserverChangeNewsVisibilityDocument,
        operationName: 'SvaMainserverChangeNewsVisibility',
        variables: { id: input.poiId, recordType: 'PointOfInterest', visible: input.visible },
      },
      config
    );
    if (!response.changeVisibility || (response.changeVisibility.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte die Sichtbarkeit des Orts nicht aktualisieren.',
        statusCode: 502,
      });
    }
  };

  const deletePoi = async (input: SvaMainserverConnectionInput & { readonly poiId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.destroyPoiWithConfig(input, config);
  };

  const transferContentOwnership = async (input: SvaMainserverOwnershipTransferInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    if (input.content.type === 'poi')
      await poiOperations.assertPoiWithoutVouchersWithConfig(
        { ...input, poiId: input.content.id },
        config
      );
    if (input.content.type === 'generic-item') {
      const current = await genericItemOperations.getGenericItemWithConfig(
        { ...input, genericItemId: input.content.id },
        config
      );
      if (current.genericType === 'Voucher') throw toSvaMainserverError({code: 'invalid_response', message: 'voucher_ownership_unsupported', statusCode: 409});
    }
    return transferContentOwnershipWithConfig(input, config);
  };

  const createOrUpdateStaticContent = async (
    input: SvaMainserverConnectionInput & {
      readonly staticContent: SvaMainserverStaticContentInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return staticContentOperations.writeStaticContentWithConfig(input, config);
  };

  return {
    getPoi,
    getPoiDetail,
    createPoi,
    updatePoi,
    deletePoi,
    changePoiVisibility,
    transferContentOwnership,
    createOrUpdateStaticContent,
  };
};
