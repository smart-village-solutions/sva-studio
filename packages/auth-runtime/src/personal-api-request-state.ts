const authenticatedPersonalApiRequests = new WeakSet<Request>();

export const markPersonalApiRequestAuthenticated = (request: Request): void => {
  authenticatedPersonalApiRequests.add(request);
};

export const isPersonalApiRequestAuthenticated = (request: Request): boolean =>
  authenticatedPersonalApiRequests.has(request);
