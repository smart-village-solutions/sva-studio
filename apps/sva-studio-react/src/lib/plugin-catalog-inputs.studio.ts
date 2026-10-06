import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';
import { installedPluginCatalogConfig } from 'virtual:studio-installed-plugin-catalog';

const workspacePluginCatalogConfig = [
  { pluginId: 'categories', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-categories' },
  { pluginId: 'news', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-news' },
  { pluginId: 'events', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-events' },
  { pluginId: 'poi', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-poi' },
  { pluginId: 'generic-items', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-generic-items' },
  { pluginId: 'faq', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-faq' },
  { pluginId: 'cockpit-cards', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-cockpit-cards' },
  { pluginId: 'projects', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-projects' },
  { pluginId: 'surveys', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-surveys' },
  { pluginId: 'waste-management', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-waste-management' },
] as const satisfies readonly StudioPluginCatalogConfigEntry[];

export const pluginCatalogConfig = [
  ...workspacePluginCatalogConfig,
  ...installedPluginCatalogConfig,
] as const satisfies readonly StudioPluginCatalogConfigEntry[];
