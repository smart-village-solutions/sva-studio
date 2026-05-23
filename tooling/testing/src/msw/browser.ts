import { setupWorker } from 'msw/browser';

import { getStudioMswHandlers } from './handlers.ts';

export const createStudioMswBrowser = () => (typeof window === 'undefined' ? undefined : setupWorker(...getStudioMswHandlers()));
