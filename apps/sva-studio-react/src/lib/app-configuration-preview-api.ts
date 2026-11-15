import { createServerFn } from '@tanstack/react-start';

/** Read-only host binding. No browser-supplied instance, principal, document or endpoint. */
export const loadAppConfigurationPreview = createServerFn({ method: 'GET' })
  .validator(async (value: unknown) => {
    const { appConfigurationSelectionSchema } = await import('@sva/sva-mainserver');
    return appConfigurationSelectionSchema.parse(value);
  })
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { loadSvaMainserverAppConfigurationPreview } = await import('@sva/sva-mainserver/server');
    return loadSvaMainserverAppConfigurationPreview(getRequest(), data);
  });
