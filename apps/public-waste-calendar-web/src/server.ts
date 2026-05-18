import { readPublicWasteBootstrapStateFromEnvironment } from './lib/public-waste-bootstrap.server.js';

export const publicWasteServerEntry = 'public-waste-calendar-web';

export const bootstrapPublicWasteServer = (input: {
  readonly rawConfigJson?: string | undefined;
} = {}) => readPublicWasteBootstrapStateFromEnvironment(input);
