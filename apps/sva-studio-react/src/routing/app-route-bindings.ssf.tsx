import type { AppRouteBindings } from '@sva/routing';
import type { PluginDefinition, PluginViewBinding } from '@sva/plugin-sdk';
import React from 'react';

import NotFound from '../components/NotFound';
import { studioPlugins } from '../lib/plugins';
import { coreAppRouteBindings } from './app-route-bindings.core';
import { createHostOwnedPluginView } from './app-plugin-view-adapter';

// Host-owned legacy content URLs remain guarded by @sva/routing, but must not
// load a standard Studio plugin page or its data in the SSF distribution.
export const appRouteBindings = {
  ...coreAppRouteBindings,
  content: NotFound,
  contentCreate: NotFound,
  contentDetail: NotFound,
} satisfies AppRouteBindings;

export const studioRoutePlugins: readonly PluginDefinition[] = studioPlugins.map((plugin) => ({
  ...plugin,
  viewBindings: (plugin.viewBindings ?? []).map((binding: PluginViewBinding) => ({
    ...binding,
    component: createHostOwnedPluginView(
      plugin.id,
      binding,
      binding.component as React.ComponentType<never>
    ) as unknown as PluginViewBinding['component'],
  })),
}));
