import { accountENResources } from './en/account.resources.js';
import { adminENResources } from './en/admin.resources.js';
import { contentENResources } from './en/content.resources.js';
import { homeENResources } from './en/home.resources.js';
import { hostENResources } from './en/host.resources.js';
import { interfacesENResources } from './en/interfaces.resources.js';
import { mediaENResources } from './en/media.resources.js';
import { monitoringENResources } from './en/monitoring.resources.js';
import { placeholderENResources } from './en/placeholder.resources.js';
import { pluginsENResources } from './en/plugins.resources.js';
import { sharedENResources } from './en/shared.resources.js';
import { shellENResources } from './en/shell.resources.js';
import { studioTableENResources } from './en/studioTable.resources.js';

export const enResources = {
  account: accountENResources,
  admin: adminENResources,
  content: contentENResources,
  home: homeENResources,
  host: hostENResources,
  interfaces: interfacesENResources,
  media: mediaENResources,
  monitoring: monitoringENResources,
  placeholder: placeholderENResources,
  plugins: pluginsENResources,
  shared: sharedENResources,
  shell: shellENResources,
  studioTable: studioTableENResources,
} as const;
