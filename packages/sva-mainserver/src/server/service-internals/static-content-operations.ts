import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverStaticContentInput,
} from '../../types.js';
import {
  svaMainserverAppConfigurationDocument,
  type SvaMainserverAppConfigurationQuery,
  svaMainserverPublicJsonFileDocument,
  type SvaMainserverPublicJsonFileQuery,
  svaMainserverCreateOrUpdateStaticContentDocument,
  svaMainserverCreateOrUpdateStaticContentWithIdDocument,
  type SvaMainserverCreateOrUpdateStaticContentMutation,
} from '../../generated/static-content.js';
import { z } from 'zod';
import {
  appConfigurationSnapshotSchema,
  type AppConfigurationSnapshot,
} from '../static-content-reconciliation.js';

import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

const selectionSchema = z
  .object({
    version: appConfigurationSnapshotSchema.shape.version,
    expectedId: z.string().min(1).optional(),
  })
  .strict();
const metadataSchema = appConfigurationSnapshotSchema.omit({ content: true });

export type AppConfigurationSelection = z.infer<typeof selectionSchema>;
export type AppConfigurationReadResult =
  | Readonly<{ status: 'read'; snapshot: AppConfigurationSnapshot }>
  | Readonly<{
      status: 'unavailable';
      reason: 'variant_not_resolved' | 'variant_mismatch' | 'raw_content_unavailable';
    }>;

export const createStaticContentOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  /** Existing GraphQL selection with explicit fallback and raw-text checks; no mutation. */
  readAppConfigurationWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly selection: AppConfigurationSelection },
    config: SvaMainserverInstanceConfig
  ): Promise<AppConfigurationReadResult> => {
    const selection = selectionSchema.safeParse(input.selection);
    if (!selection.success)
      throw toSvaMainserverError({
        code: 'invalid_config',
        message: 'app_configuration_selection_invalid',
        statusCode: 400,
      });
    const response = await executeGraphqlWithConfig<SvaMainserverAppConfigurationQuery>(
      {
        ...input,
        document: svaMainserverAppConfigurationDocument,
        operationName: 'SvaMainserverAppConfiguration',
        variables: { name: 'globalSettings', version: selection.data.version },
      },
      config
    );
    const file = response.publicJsonFile;
    if (!file || file.id === null || file.id === undefined)
      return { status: 'unavailable', reason: 'variant_not_resolved' };
    if (
      typeof file.id !== 'string' &&
      !(typeof file.id === 'number' && Number.isSafeInteger(file.id) && file.id > 0)
    )
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'app_configuration_metadata_invalid',
        statusCode: 502,
      });
    const metadata = metadataSchema.safeParse({
      instanceId: input.instanceId,
      id: String(file.id),
      name: file.name,
      dataType: file.dataType,
      version: file.version,
    });
    if (!metadata.success)
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'app_configuration_metadata_invalid',
        statusCode: 502,
      });
    if (
      metadata.data.version !== selection.data.version ||
      (selection.data.expectedId !== undefined && metadata.data.id !== selection.data.expectedId)
    )
      return { status: 'unavailable', reason: 'variant_mismatch' };
    // Versioned responses pass through JSON.parse upstream, including JSON strings.
    if (selection.data.version !== null || typeof file.content !== 'string')
      return { status: 'unavailable', reason: 'raw_content_unavailable' };
    return { status: 'read', snapshot: { ...metadata.data, content: file.content } };
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

    const response =
      await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateStaticContentMutation>(
        {
          ...input,
          // The Mainserver may have committed before a transport error reaches Studio.
          // Repeating this mutation has no upstream idempotency guarantee.
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
  },
});
