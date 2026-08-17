export type PluginWorkerBootstrapLogger = {
  error(message: string, meta: Record<string, unknown>): void;
  info(message: string, meta: Record<string, unknown>): void;
};

export const logPluginWorkerBootstrapFailure = (
  logger: PluginWorkerBootstrapLogger,
  error: unknown
): void => {
  logger.error('Plugin worker bootstrap failed', {
    operation: 'plugin_operation_worker_bootstrap',
    error: error instanceof Error ? error.message : String(error),
  });
};
