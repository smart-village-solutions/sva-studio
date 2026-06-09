import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverStaticContentInput,
} from '../../types.js';
import {
  svaMainserverPublicJsonFileDocument,
  type SvaMainserverPublicJsonFileQuery,
  svaMainserverCreateOrUpdateStaticContentDocument,
  svaMainserverCreateOrUpdateStaticContentWithIdDocument,
  type SvaMainserverCreateOrUpdateStaticContentMutation,
} from '../../generated/static-content.js';

import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export const createStaticContentOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  writeStaticContentWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const normalizedName = input.staticContent.name.trim().toLowerCase();
    const existingFile = await executeGraphqlWithConfig<SvaMainserverPublicJsonFileQuery>(
      {
        ...input,
        document: svaMainserverPublicJsonFileDocument,
        operationName: 'SvaMainserverPublicJsonFile',
        variables: {
          name: normalizedName,
        },
      },
      config
    );
    const existingId = existingFile.publicJsonFile?.id;

    const response = await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateStaticContentMutation>(
      {
        ...input,
        document:
          existingId === null || existingId === undefined
            ? svaMainserverCreateOrUpdateStaticContentDocument
            : svaMainserverCreateOrUpdateStaticContentWithIdDocument,
        operationName:
          existingId === null || existingId === undefined
            ? 'SvaMainserverCreateOrUpdateStaticContent'
            : 'SvaMainserverCreateOrUpdateStaticContentWithId',
        variables: {
          ...input.staticContent,
          name: normalizedName,
          ...(existingId === null || existingId === undefined ? {} : { id: String(existingId) }),
          dataType: 'json',
          version: '',
        },
      },
      config
    );

    const id = response.createOrUpdateStaticContent?.id;
    if (id === null || id === undefined) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte den Static-Content-Eintrag nicht schreiben.',
        statusCode: 502,
      });
    }

    return { id: String(id) };
  },
});
