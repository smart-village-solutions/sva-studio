import {
  svaMainserverMutationRootTypenameDocument,
  svaMainserverQueryRootTypenameDocument,
  type SvaMainserverMutationRootTypenameMutation,
  type SvaMainserverQueryRootTypenameQuery,
} from '../../generated/diagnostics.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverConnectionStatus,
  SvaMainserverInstanceConfig,
} from '../../types.js';
import { buildLogContext, logger } from './observability.js';
import { normalizeUnexpectedError, unwrapSettledResult } from './shared.js';
import type { createGraphqlExecutor } from './graphql-client.js';

type DiagnosticsDependencies = {
  loadValidatedInstanceConfig: (
    input: SvaMainserverConnectionInput,
    operationName: string
  ) => Promise<SvaMainserverInstanceConfig>;
  executeGraphqlWithConfig: ReturnType<typeof createGraphqlExecutor>;
  now: () => number;
};

export const createServiceDiagnostics = ({
  loadValidatedInstanceConfig,
  executeGraphqlWithConfig,
  now,
}: DiagnosticsDependencies) => {
  const getQueryRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverQueryRootTypenameQuery> =>
    executeGraphqlWithConfig<SvaMainserverQueryRootTypenameQuery>(
      {
        ...input,
        document: svaMainserverQueryRootTypenameDocument,
        operationName: 'SvaMainserverQueryRootTypename',
      },
      config
    );

  const getMutationRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverMutationRootTypenameMutation> =>
    executeGraphqlWithConfig<SvaMainserverMutationRootTypenameMutation>(
      {
        ...input,
        document: svaMainserverMutationRootTypenameDocument,
        operationName: 'SvaMainserverMutationRootTypename',
      },
      config
    );

  const getQueryRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverQueryRootTypenameQuery> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getQueryRootTypenameWithConfig(input, config);
  };

  const getMutationRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverMutationRootTypenameMutation> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getMutationRootTypenameWithConfig(input, config);
  };

  const getConnectionStatus = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverConnectionStatus> => {
    try {
      const config = await loadValidatedInstanceConfig(input, 'connection_check');
      const [queryRootResult, mutationRootResult] = await Promise.allSettled([
        getQueryRootTypenameWithConfig(input, config),
        getMutationRootTypenameWithConfig(input, config),
      ]);
      const queryRoot = unwrapSettledResult(queryRootResult);
      const mutationRoot = unwrapSettledResult(mutationRootResult);

      if (!queryRoot.ok) {
        throw queryRoot.error;
      }
      if (!mutationRoot.ok) {
        throw mutationRoot.error;
      }

      logger.debug('SVA Mainserver connection check succeeded', {
        ...buildLogContext(input, {
          operation: 'connection_check',
        }),
      });

      return {
        status: 'connected',
        checkedAt: new Date(now()).toISOString(),
        config,
        queryRootTypename: queryRoot.value.__typename,
        mutationRootTypename: mutationRoot.value.__typename,
      };
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);

      logger.warn('SVA Mainserver connection check failed', {
        ...buildLogContext(input, {
          operation: 'connection_check',
          error_code: normalizedError.code,
          error_message: normalizedError.message,
        }),
      });

      return {
        status: 'error',
        checkedAt: new Date(now()).toISOString(),
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      };
    }
  };

  return { getQueryRootTypename, getMutationRootTypename, getConnectionStatus };
};
