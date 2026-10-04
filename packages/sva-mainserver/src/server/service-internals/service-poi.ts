import type {
  SvaMainserverConnectionInput,
  SvaMainserverOwnershipTransferInput,
  SvaMainserverPoiInput,
  SvaMainserverStaticContentInput,
} from '../../types.js';
import { mergePoiUpdateWithCurrent } from './editor-field-matrices.js';
import type { ServiceContext } from './service-context.js';
import { withUpdatedPayload } from './shared.js';

export const createPoiService = ({
  loadValidatedInstanceConfig,
  poiOperations,
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
    return poiOperations.writePoiWithConfig(
      {
        ...input,
        poi: {
          ...mergePoiUpdateWithCurrent(current.data, input.poi, current.deviations),
          payload: withUpdatedPayload(
            input.poi.payload === undefined ? current.data.payload : input.poi.payload,
            current.data.payload
          ),
        },
        forceCreate: true,
      },
      config
    );
  };

  const deletePoi = async (
    input: SvaMainserverConnectionInput & {
      readonly poiId: string;
      readonly detachLinkedContent?: boolean;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.destroyPoiWithConfig(input, config);
  };

  const transferContentOwnership = async (input: SvaMainserverOwnershipTransferInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
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
    transferContentOwnership,
    createOrUpdateStaticContent,
  };
};
