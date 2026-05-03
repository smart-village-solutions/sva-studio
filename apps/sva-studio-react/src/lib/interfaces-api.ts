import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import {
  loadSvaMainserverInterfacesOverview as loadSvaMainserverInterfacesOverviewContract,
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverInterfacesOverview,
  saveSvaMainserverInterfaceSettings as saveSvaMainserverInterfaceSettingsContract,
} from '@sva/sva-mainserver/server';

export const loadSvaMainserverInterfacesOverviewServerFn = createServerFn().handler(
  async (): Promise<SvaMainserverInterfacesOverview> =>
    loadSvaMainserverInterfacesOverviewContract(getRequest())
);

export const loadInterfacesOverview = loadSvaMainserverInterfacesOverviewServerFn;

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((payload: SaveSvaMainserverInterfaceSettingsInput['data']) => payload)
  .handler(async ({ data }) =>
    saveSvaMainserverInterfaceSettingsContract(getRequest(), {
      data,
    })
  );
