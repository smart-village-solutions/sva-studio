export { createSdkLogger } from './logger';
export { withRequestContext } from './middleware/request-context';

// Keep auth integrations stable without pulling the full monitoring stack into this PR.
export const initializeOtelSdk = async (): Promise<void> => {
  return Promise.resolve();
};
