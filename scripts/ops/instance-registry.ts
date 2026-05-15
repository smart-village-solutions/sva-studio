import { pathToFileURL } from 'node:url';

import {
  createInstanceRegistryCommandContext,
  instanceRegistryCliLogger,
  type InstanceRegistryCommandContext,
} from './instance-registry/command-context.js';
import { renderResult } from './instance-registry/formatters.js';
import { parseInstanceRegistryCliOptions } from './instance-registry/parse-options.js';
import { runMutationCommand } from './instance-registry/mutation-commands.js';
import { runReadCommand } from './instance-registry/read-commands.js';
import { isReadCommand } from './instance-registry/shared.js';

type RunInstanceRegistryCliDeps = {
  readonly createContext?: (databaseUrl: string) => InstanceRegistryCommandContext;
  readonly env?: NodeJS.ProcessEnv;
};

export const runInstanceRegistryCli = async (
  argv: readonly string[],
  deps: RunInstanceRegistryCliDeps = {}
): Promise<number> => {
  const options = parseInstanceRegistryCliOptions(argv);
  const env = deps.env ?? process.env;
  const databaseUrl = env['IAM_DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('IAM_DATABASE_URL ist nicht gesetzt.');
  }

  const context = (deps.createContext ?? createInstanceRegistryCommandContext)(databaseUrl);

  try {
    const result = isReadCommand(options.command)
      ? await runReadCommand(context, options)
      : await context.withTransaction((service) => runMutationCommand(service, options));

    context.logger.info('Instance registry CLI operation completed', {
      operation: `instance_registry_cli_${options.command}`,
      instance_id: options.instanceId,
      actor_id: options.actorId,
      idempotency_key: options.idempotencyKey,
    });
    renderResult(options.jsonOutput, result);
    return 0;
  } finally {
    await context.close();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runInstanceRegistryCli(process.argv.slice(2)).catch((error) => {
    instanceRegistryCliLogger.error('Instance registry CLI failed', {
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
    });
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
