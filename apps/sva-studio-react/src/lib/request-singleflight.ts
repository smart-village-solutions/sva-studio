const inFlightRequests = new Map<string, Promise<unknown>>();

export const requestSingleFlight = <T>(key: string, request: () => Promise<T>): Promise<T> => {
  const inFlightRequest = inFlightRequests.get(key) as Promise<T> | undefined;
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const nextRequest = request().finally(() => {
    if (inFlightRequests.get(key) === nextRequest) {
      inFlightRequests.delete(key);
    }
  });

  inFlightRequests.set(key, nextRequest);
  return nextRequest;
};

export const resetRequestSingleFlight = (): void => {
  inFlightRequests.clear();
};
