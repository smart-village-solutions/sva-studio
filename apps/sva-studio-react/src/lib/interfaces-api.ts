import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import {
  loadSvaMainserverInterfacesOverview,
  saveSvaMainserverInterfaceSettings as saveSvaMainserverInterfaceSettingsContract,
} from '@sva/sva-mainserver/server';

type SaveInterfacesPayload = {
  readonly graphqlBaseUrl?: string;
  readonly oauthTokenUrl?: string;
  readonly enabled?: boolean;
};

export const loadInterfacesOverview = createServerFn().handler(async () =>
  loadSvaMainserverInterfacesOverview(getRequest())
);

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((payload: SaveInterfacesPayload) => payload)
  .handler(async ({ data }) =>
    saveSvaMainserverInterfaceSettingsContract(getRequest(), {
      data,
    })
  );
