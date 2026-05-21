import { setupWorker } from 'msw/browser';

import { studioMswHandlers } from './handlers.ts';

export const studioMswBrowser = typeof window === 'undefined' ? undefined : setupWorker(...studioMswHandlers);
