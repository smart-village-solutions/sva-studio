import { createServerFn } from '@tanstack/react-start';

import {
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverInterfacesOverview,
} from '@sva/sva-mainserver/server';

export const loadSvaMainserverInterfacesOverviewServerFn = createServerFn().handler(
  async (): Promise<SvaMainserverInterfacesOverview> => {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { loadSvaMainserverInterfacesOverview } = await import('@sva/sva-mainserver/server');

    return loadSvaMainserverInterfacesOverview(getRequest());
  }
);

export const loadInterfacesOverview = loadSvaMainserverInterfacesOverviewServerFn;

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((payload: SaveSvaMainserverInterfaceSettingsInput['data']) => payload)
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { saveSvaMainserverInterfaceSettings } = await import('@sva/sva-mainserver/server');

    return saveSvaMainserverInterfaceSettings(getRequest(), {
      data,
    })
  });
