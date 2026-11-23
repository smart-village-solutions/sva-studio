import { z } from 'zod';
import {
  appConfigurationIdSchema,
  appConfigurationRecordSchema,
  appConfigurationSaveSchema,
  type AppConfigurationDocument,
  type AppConfigurationSave,
  type AppConfigurationSyncResult,
} from '../../app-configuration.js';
import {
  svaMainserverStaticJsonByIdDocument,
  svaMainserverStaticJsonOverviewDocument,
  svaMainserverUpdateStaticJsonDocument,
} from '../../generated/static-content.js';
import type {
  SvaMainserverConnectionInput as Connection,
  SvaMainserverInstanceConfig as Config,
} from '../../types.js';
import {
  readAppConfigurationFields,
  reconcileAppConfiguration,
} from '../app-configuration-reconciliation.js';
import { SvaMainserverError } from '../errors.js';
import type { createServiceContext } from './service-context.js';

const storedDocument = appConfigurationRecordSchema.extend({
  revision: z.string().min(1),
  content: z.string().nullable(),
});
const listResponse = z.object({ staticContents: z.array(appConfigurationRecordSchema) });
const readResponse = z.object({ staticContent: storedDocument.nullable() });
const updateResponse = z.object({
  createOrUpdateStaticContent: z.object({ id: appConfigurationIdSchema }),
});

const project = ({
  content,
  ...record
}: z.infer<typeof storedDocument>): AppConfigurationDocument => ({
  ...record,
  fields:
    /^globalsettings$/i.test(record.name) && content !== null
      ? readAppConfigurationFields(content)
      : null,
});

const compareAfterRevisionConflict = (
  fresh: z.infer<typeof storedDocument> | null,
  data: AppConfigurationSave
): AppConfigurationSyncResult => {
  if (!fresh) return { status: 'missing' };
  const document = project(fresh);
  if (!document.fields || fresh.content === null) return { status: 'unsupported' };
  const comparison = reconcileAppConfiguration(fresh.content, document.fields, fresh.revision, {
    ...data,
    reviewedRevision: undefined,
    choices: undefined,
  });
  if (comparison.status === 'unsupported') return comparison;
  return {
    status: 'review',
    document,
    conflicts: comparison.status === 'review' ? comparison.conflicts : [],
  };
};

export const createAppConfigurationService = (
  context: Pick<
    ReturnType<typeof createServiceContext>,
    'executeGraphqlWithConfig' | 'loadValidatedInstanceConfig'
  >
) => {
  const read = async (input: Connection, config: Config, id: string) => {
    const response = await context.executeGraphqlWithConfig<unknown>(
      {
        ...input,
        document: svaMainserverStaticJsonByIdDocument,
        operationName: 'SvaMainserverStaticJsonById',
        variables: { id },
      },
      config
    );
    const entry = readResponse.parse(response).staticContent;
    if (entry && entry.id !== id) throw new Error('app_configuration_identity_mismatch');
    return entry;
  };

  const save = async (
    input: Connection,
    data: AppConfigurationSave
  ): Promise<AppConfigurationSyncResult> => {
    const validated = appConfigurationSaveSchema.parse(data);
    const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
    const entry = await read(input, config, validated.id);
    if (!entry) return { status: 'missing' };
    const document = project(entry);
    if (!document.fields || entry.content === null) return { status: 'unsupported' };
    const result = reconcileAppConfiguration(
      entry.content,
      document.fields,
      entry.revision,
      validated
    );
    if (result.status === 'unsupported') return result;
    if (result.status === 'review') return { ...result, document };
    if (result.content === entry.content) return { status: 'saved', document };

    try {
      const response = await context.executeGraphqlWithConfig<unknown>(
        {
          ...input,
          allowRetry: false,
          document: svaMainserverUpdateStaticJsonDocument,
          operationName: 'SvaMainserverUpdateStaticJson',
          variables: { id: entry.id, revision: entry.revision, content: result.content },
          mapErrorCode: (code) =>
            code === 'REVISION_CONFLICT'
              ? new SvaMainserverError({
                  code: 'graphql_error',
                  message: 'REVISION_CONFLICT',
                  statusCode: 409,
                })
              : undefined,
        },
        config
      );
      if (updateResponse.parse(response).createOrUpdateStaticContent.id !== entry.id)
        return { status: 'unconfirmed' };
    } catch (error) {
      if (error instanceof SvaMainserverError && error.message === 'REVISION_CONFLICT') {
        const fresh = await read(input, config, entry.id);
        return compareAfterRevisionConflict(fresh, validated);
      }
      return { status: 'unconfirmed' };
    }
    try {
      const after = await read(input, config, entry.id);
      if (
        after?.name === entry.name &&
        after.version === entry.version &&
        after.content === result.content
      )
        return { status: 'saved', document: project(after) };
    } catch {
      return { status: 'unconfirmed' };
    }
    return { status: 'unconfirmed' };
  };

  return {
    listAppConfiguration: async (input: Connection) => {
      const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
      const response = await context.executeGraphqlWithConfig<unknown>(
        {
          ...input,
          document: svaMainserverStaticJsonOverviewDocument,
          operationName: 'SvaMainserverStaticJsonOverview',
        },
        config
      );
      return listResponse.parse(response).staticContents;
    },
    getAppConfiguration: async (input: Connection, id: string) => {
      const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
      const entry = await read(input, config, appConfigurationIdSchema.parse(id));
      return entry ? project(entry) : null;
    },
    saveAppConfiguration: save,
  };
};
