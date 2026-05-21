import { setupWorker } from 'msw/browser';

import { getStudioMswHandlers } from './handlers.ts';

export const studioMswBrowser = typeof window === 'undefined' ? undefined : setupWorker(...getStudioMswHandlers());
