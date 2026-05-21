import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetStudioMswHandlers } from './reset.ts';
import { studioMswServer } from './server.ts';

beforeAll(() => {
  studioMswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  resetStudioMswHandlers();
});

afterAll(() => {
  studioMswServer.close();
});
