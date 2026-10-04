import type {
  SvaMainserverConnectionInput,
  SvaMainserverGenericTypeOwnership,
  SvaMainserverListQuery,
  SvaMainserverNewsListInput,
  SvaMainserverNewsInput,
  SvaMainserverProjectionContentType,
} from '../../types.js';
import type { ServiceContext } from './service-context.js';
import { withUpdatedPayload } from './shared.js';

export const createNewsService = ({
  loadValidatedInstanceConfig,
  loadListCredentialMetadata,
  newsOperations,
  projectionListOperations,
  newsVisibilityOperations,
}: ServiceContext) => {
  const listNews = async (input: SvaMainserverConnectionInput & SvaMainserverNewsListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await newsOperations.listNewsWithConfig(input, config)),
      ...credentialMetadata,
    };
  };

  const listProjection = async (
    input: SvaMainserverConnectionInput &
      SvaMainserverListQuery & {
        readonly contentType: SvaMainserverProjectionContentType;
        readonly genericTypeOwnership: SvaMainserverGenericTypeOwnership;
      }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await projectionListOperations.listProjectionWithConfig(
        input.contentType,
        input,
        config,
        input.genericTypeOwnership
      )),
      ...credentialMetadata,
    };
  };

  const getNews = async (input: SvaMainserverConnectionInput & { readonly newsId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.getNewsWithConfig(input, config);
  };

  const createNews = async (
    input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.writeNewsWithConfig(input, config);
  };

  const updateNews = async (
    input: SvaMainserverConnectionInput & {
      readonly newsId: string;
      readonly news: SvaMainserverNewsInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const current = await newsOperations.getNewsWithConfig(input, config);
    return newsOperations.writeNewsWithConfig(
      {
        ...input,
        news: {
          ...input.news,
          payload: withUpdatedPayload(input.news.payload, current.payload),
        },
        forceCreate: true,
      },
      config
    );
  };

  const deleteNews = async (input: SvaMainserverConnectionInput & { readonly newsId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.destroyNewsWithConfig(input, config);
  };

  const changeNewsVisibility = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await newsVisibilityOperations.changeNewsVisibilityWithConfig(input, config);
  };

  return {
    listNews,
    listProjection,
    getNews,
    createNews,
    updateNews,
    deleteNews,
    changeNewsVisibility,
  };
};
