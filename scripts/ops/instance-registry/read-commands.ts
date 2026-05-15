import type { InstanceRegistryCommandContext } from './command-context.js';
import type { CliOptions } from './shared.js';

export const runReadCommand = async (
  context: InstanceRegistryCommandContext,
  options: CliOptions
): Promise<unknown> => {
  const service = context.createReadService();

  switch (options.command) {
    case 'list':
      return service.listInstances({
        search: options.search,
        status: options.status,
      });
    default:
      throw new Error(`Unerwarteter Read-Command: ${options.command}`);
  }
};
