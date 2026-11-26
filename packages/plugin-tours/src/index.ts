import type { PluginDefinition } from '@sva/plugin-sdk';

import { pluginTours as descriptor } from './descriptor.js';
import { TourCreatePage } from './tour-create-page.js';
import { TourDetailPage, ToursListPage } from './tours.pages.js';

export const pluginViewBindings = [
  { bindingKey: 'toursList', component: ToursListPage },
  { bindingKey: 'toursDetail', component: TourDetailPage },
  { bindingKey: 'toursEditor', component: TourCreatePage },
] as const;

export const pluginTours: PluginDefinition = { ...descriptor, routes: [] };
