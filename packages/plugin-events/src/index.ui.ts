export { EventsDetailPage } from './events.detail-page.js';
export { EventsCreatePage, EventsEditPage } from './events.pages.js';
export { EventsListPage } from './events.pages.js';
export { pluginEvents } from './plugin.js';
import { EventsCreatePage, EventsEditPage } from './events.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'eventsDetail', component: EventsEditPage },
  { bindingKey: 'eventsEditor', component: EventsCreatePage },
] as const;
