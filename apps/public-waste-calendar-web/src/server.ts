import { readPublicWasteBootstrapStateFromEnvironment } from './lib/public-waste-bootstrap.server.js';

export const publicWasteServerEntry = 'public-waste-calendar-web';

export const bootstrapPublicWasteServer = (input: {
  readonly env?: NodeJS.ProcessEnv;
  readonly rawConfigJson?: string | undefined;
} = {}) => readPublicWasteBootstrapStateFromEnvironment(input);
