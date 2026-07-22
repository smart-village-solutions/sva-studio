import { accountDEResources } from './de/account.resources.js';
import { adminDEResources } from './de/admin.resources.js';
import { contentDEResources } from './de/content.resources.js';
import { homeDEResources } from './de/home.resources.js';
import { hostDEResources } from './de/host.resources.js';
import { interfacesDEResources } from './de/interfaces.resources.js';
import { mediaDEResources } from './de/media.resources.js';
import { monitoringDEResources } from './de/monitoring.resources.js';
import { placeholderDEResources } from './de/placeholder.resources.js';
import { pluginsDEResources } from './de/plugins.resources.js';
import { sharedDEResources } from './de/shared.resources.js';
import { shellDEResources } from './de/shell.resources.js';
import { studioTableDEResources } from './de/studioTable.resources.js';

export const deResources = {
  account: accountDEResources,
  admin: adminDEResources,
  content: contentDEResources,
  home: homeDEResources,
  host: hostDEResources,
  interfaces: interfacesDEResources,
  media: mediaDEResources,
  monitoring: monitoringDEResources,
  placeholder: placeholderDEResources,
  plugins: pluginsDEResources,
  shared: sharedDEResources,
  shell: shellDEResources,
  studioTable: studioTableDEResources,
} as const;
