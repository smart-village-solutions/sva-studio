import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const readAppConfiguration = createServerFn({ method: 'GET' })
  .validator(async (value: unknown) => {
    const { appConfigurationIdSchema } = await import('@sva/sva-mainserver');
    return z.object({ id: appConfigurationIdSchema.optional() }).strict().parse(value);
  })
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { readAppConfiguration } = await import('./app-configuration-sync.server');
    return readAppConfiguration(getRequest(), data);
  });

export const saveAppConfiguration = createServerFn({ method: 'POST' })
  .validator(async (value: unknown) => {
    const { appConfigurationSaveSchema } = await import('@sva/sva-mainserver');
    return appConfigurationSaveSchema.parse(value);
  })
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { saveAppConfiguration } = await import('./app-configuration-sync.server');
    return saveAppConfiguration(getRequest(), data);
  });
