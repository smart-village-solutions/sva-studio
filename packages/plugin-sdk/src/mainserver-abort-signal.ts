export const combineAbortSignals = (
  signals: readonly AbortSignal[]
): {
  readonly cancel: () => void;
  readonly signal: AbortSignal;
} => {
  if (signals.length === 1) {
    return {
      cancel: () => undefined,
      signal: signals[0]!,
    };
  }

  if (typeof AbortSignal.any === 'function') {
    return {
      cancel: () => undefined,
      signal: AbortSignal.any([...signals]),
    };
  }

  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abortFrom = (signal: AbortSignal) => {
    controller.abort(signal.reason);
  };
  const cleanup = () => {
    for (const [signal, handleAbort] of listeners.entries()) {
      signal.removeEventListener('abort', handleAbort);
    }
    listeners.clear();
  };

  for (const signal of signals) {
    if (signal.aborted) {
      cleanup();
      abortFrom(signal);
      return { cancel: cleanup, signal: controller.signal };
    }

    const handleAbort = () => {
      abortFrom(signal);
    };
    listeners.set(signal, handleAbort);
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  return { cancel: cleanup, signal: controller.signal };
};
