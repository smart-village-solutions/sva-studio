import { createServerFn } from '@tanstack/react-start';

import type { DevelopmentLogEntry } from '@sva/server-runtime';

type DevelopmentLogQueryInput = {
  readonly afterId?: number;
};

export const readDevelopmentServerLogs = async (data: DevelopmentLogQueryInput = {}): Promise<DevelopmentLogEntry[]> => {
  const sdk = await import('@sva/server-runtime');
  const runtimeConfig = sdk.getLoggingRuntimeConfig();

  if (!runtimeConfig.uiEnabled) {
    return [];
  }

  return sdk.readDevelopmentLogEntries({
    afterId: data.afterId,
  });
};

export const loadDevelopmentServerLogs = createServerFn()
  .inputValidator((data: DevelopmentLogQueryInput | undefined) => data ?? {})
  .handler(async ({ data }): Promise<DevelopmentLogEntry[]> => {
    return readDevelopmentServerLogs(data);
  });
