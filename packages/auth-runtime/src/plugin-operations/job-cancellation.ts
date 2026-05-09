export class PluginOperationCancellationError extends Error {
  readonly cancelRequestedAt?: string;

  constructor(message = 'Plugin operation cancelled.', cancelRequestedAt?: string) {
    super(message);
    this.name = 'PluginOperationCancellationError';
    this.cancelRequestedAt = cancelRequestedAt;
  }
}

export const isPluginOperationCancellationError = (
  error: unknown
): error is PluginOperationCancellationError => error instanceof PluginOperationCancellationError;

export const throwIfCancellationRequested = async (input: {
  readonly isCancellationRequested: () => Promise<boolean>;
  readonly cancelRequestedAt?: string;
}): Promise<void> => {
  if (await input.isCancellationRequested()) {
    throw new PluginOperationCancellationError('Plugin operation cancelled.', input.cancelRequestedAt);
  }
};
