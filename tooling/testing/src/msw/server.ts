import { setupServer } from 'msw/node';

import { getStudioMswHandlers } from './handlers.ts';

export const studioMswServer = setupServer(...getStudioMswHandlers());
