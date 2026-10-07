import type { AppRouteBindings } from '@sva/routing';

import NotFound from '../components/NotFound';
import { studioPlugins } from '../lib/plugins';
import { coreAppRouteBindings } from './app-route-bindings.core';

// Host-owned legacy content URLs remain guarded by @sva/routing, but must not
// load a standard Studio plugin page or its data in the SSF distribution.
export const appRouteBindings = {
  ...coreAppRouteBindings,
  content: NotFound,
  contentCreate: NotFound,
  contentDetail: NotFound,
} satisfies AppRouteBindings;

export const studioRoutePlugins = studioPlugins;
