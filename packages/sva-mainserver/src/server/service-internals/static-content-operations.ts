import {
  appConfigurationSelectionSchema,
  type AppConfigurationSelection,
} from '../../app-configuration-preview.js';
import { projectAppConfigurationPreview } from '../static-content-preview.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverStaticContentInput,
} from '../../types.js';
import {
  svaMainserverPublicJsonFileDocument,
  svaMainserverAppConfigurationPreviewDocument,
  type SvaMainserverPublicJsonFileQuery,
  svaMainserverCreateOrUpdateStaticContentDocument,
  svaMainserverCreateOrUpdateStaticContentWithIdDocument,
  type SvaMainserverCreateOrUpdateStaticContentMutation,
} from '../../generated/static-content.js';

import { normalizeUnexpectedError, toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export const createStaticContentOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  readAppConfigurationPreviewWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly selection: AppConfigurationSelection },
    config: SvaMainserverInstanceConfig
  ) => {
    const selection = appConfigurationSelectionSchema.safeParse(input.selection);
    if (!selection.success)
      throw toSvaMainserverError({
        code: 'invalid_config',
        message: 'app_configuration_selection_invalid',
        statusCode: 400,
      });
    const response = await executeGraphqlWithConfig<{ readonly publicJsonFile?: unknown }>(
      {
        ...input,
        document: svaMainserverAppConfigurationPreviewDocument,
        operationName: 'SvaMainserverAppConfigurationPreview',
        variables: { name: 'globalSettings', version: selection.data.version },
      },
      config
    );
    return projectAppConfigurationPreview(
      response.publicJsonFile,
      input.instanceId,
      selection.data
    );
  },

  writeStaticContentWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly staticContent: SvaMainserverStaticContentInput;
    },
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
    const variables =
      existingId === null || existingId === undefined
        ? {
            name: normalizedName,
            content: input.staticContent.content,
            dataType: 'json' as const,
            version: '',
          }
        : {
            id: String(existingId),
            name: normalizedName,
            content: input.staticContent.content,
            dataType: 'json' as const,
            version: '',
          };

    try {
      const response =
        await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateStaticContentMutation>(
          {
            ...input,
            // A transport failure can follow a committed write; the mutation is not idempotent.
            allowRetry: false,
            document:
              existingId === null || existingId === undefined
                ? svaMainserverCreateOrUpdateStaticContentDocument
                : svaMainserverCreateOrUpdateStaticContentWithIdDocument,
            operationName:
              existingId === null || existingId === undefined
                ? 'SvaMainserverCreateOrUpdateStaticContent'
                : 'SvaMainserverCreateOrUpdateStaticContentWithId',
            variables,
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
    } catch (error) {
      // Reuse the job lifecycle contract so a failed response cannot repeat this write.
      throw Object.assign(normalizeUnexpectedError(error), {
        cause: { retry: { kind: 'terminal' } },
      });
    }
  },
});
