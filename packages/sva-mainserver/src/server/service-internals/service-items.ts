import type { SvaMainserverConnectionInput, SvaMainserverGenericItemInput } from '../../types.js';
import { withUpdatedPayload, type SvaMainserverListInput } from './shared.js';
import type { ServiceContext } from './service-context.js';

export const createItemService = ({
  loadValidatedInstanceConfig,
  loadListCredentialMetadata,
  poiOperations,
  genericItemOperations,
  genericItemVisibilityOperations,
}: ServiceContext) => {
  const listPoi = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await poiOperations.listPoiWithConfig(input, config)),
      ...credentialMetadata,
    };
  };

  const listGenericItems = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await genericItemOperations.listGenericItemsWithConfig(input, config)),
      ...credentialMetadata,
    };
  };

  const changeGenericItemVisibility = async (
    input: SvaMainserverConnectionInput & {
      readonly genericItemId: string;
      readonly visible: boolean;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await genericItemVisibilityOperations.changeGenericItemVisibilityWithConfig(input, config);
  };

  const getGenericItem = async (
    input: SvaMainserverConnectionInput & { readonly genericItemId: string }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return genericItemOperations.getGenericItemWithConfig(input, config);
  };

  const createGenericItem = async (
    input: SvaMainserverConnectionInput & { readonly genericItem: SvaMainserverGenericItemInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return genericItemOperations.writeGenericItemWithConfig(input, config);
  };

  const updateGenericItem = async (
    input: SvaMainserverConnectionInput & {
      readonly genericItemId: string;
      readonly genericItem: SvaMainserverGenericItemInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const current = await genericItemOperations.getGenericItemWithConfig(input, config);
    return genericItemOperations.writeGenericItemWithConfig(
      {
        ...input,
        genericItem: {
          ...input.genericItem,
          payload: withUpdatedPayload(
            input.genericItem.payload === undefined ? current.payload : input.genericItem.payload,
            current.payload
          ),
        },
        forceCreate: true,
      },
      config
    );
  };

  const deleteGenericItem = async (
    input: SvaMainserverConnectionInput & {
      readonly genericItemId: string;
      readonly detachLinkedContent?: boolean;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return genericItemOperations.destroyGenericItemWithConfig(input, config);
  };

  return {
    listPoi,
    listGenericItems,
    changeGenericItemVisibility,
    getGenericItem,
    createGenericItem,
    updateGenericItem,
    deleteGenericItem,
  };
};
