import type { SvaMainserverConnectionInput, SvaMainserverGenericItemInput } from '../../types.js';
import { toSvaMainserverError, withUpdatedPayload, type SvaMainserverListInput } from './shared.js';
import type { ServiceContext } from './service-context.js';

const assertNonJob = (...types: readonly string[]) => {
  if (types.includes('Job'))
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'job_dedicated_editor_required',
      statusCode: 409,
    });
};

export const createItemService = ({
  loadValidatedInstanceConfig,
  loadListCredentialMetadata,
  poiOperations,
  genericItemOperations,
  genericItemVisibilityOperations,
}: Pick<
  ServiceContext,
  | 'loadValidatedInstanceConfig'
  | 'loadListCredentialMetadata'
  | 'poiOperations'
  | 'genericItemOperations'
  | 'genericItemVisibilityOperations'
>) => {
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
    const current = await genericItemOperations.getGenericItemWithConfig(input, config);
    assertNonJob(current.genericType);
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
    assertNonJob(input.genericItem.genericType);
    if (input.genericItem.genericType === 'Voucher')
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'voucher_dedicated_editor_required',
        statusCode: 409,
      });
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
    assertNonJob(current.genericType, input.genericItem.genericType);
    if (current.genericType === 'Voucher' || input.genericItem.genericType === 'Voucher')
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'voucher_dedicated_editor_required',
        statusCode: 409,
      });
    return genericItemOperations.writeGenericItemWithConfig(
      {
        ...input,
        genericItem: {
          ...input.genericItem,
          payload: withUpdatedPayload(input.genericItem.payload, current.payload),
        },
        forceCreate: true,
      },
      config
    );
  };

  const deleteGenericItem = async (
    input: SvaMainserverConnectionInput & { readonly genericItemId: string }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const current = await genericItemOperations.getGenericItemWithConfig(input, config);
    assertNonJob(current.genericType);
    if (current.genericType === 'Voucher')
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'voucher_delete_unsupported',
        statusCode: 409,
      });
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
