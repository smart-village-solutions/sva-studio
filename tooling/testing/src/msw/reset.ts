import { getStudioMswHandlers } from './handlers.ts';
import { studioMswServer } from './server.ts';

export const resetStudioMswHandlers = (): void => {
  studioMswServer.resetHandlers(...getStudioMswHandlers());
};
