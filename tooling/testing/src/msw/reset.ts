import { afterAll, afterEach, beforeAll } from 'vitest';

import { studioMswHandlers } from './handlers.ts';
import { studioMswServer } from './server.ts';

export const resetStudioMswHandlers = (): void => {
  studioMswServer.resetHandlers(...studioMswHandlers);
};

export const setupStudioMswLifecycle = (): void => {
  beforeAll(() => {
    studioMswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    resetStudioMswHandlers();
  });

  afterAll(() => {
    studioMswServer.close();
  });
};

setupStudioMswLifecycle();
