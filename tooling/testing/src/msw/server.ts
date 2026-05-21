import { setupServer } from 'msw/node';

import { studioMswHandlers } from './handlers.ts';

export const studioMswServer = setupServer(...studioMswHandlers);
