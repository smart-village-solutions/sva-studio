import type { PluginCatalogEntry, PluginCatalogSourceType } from '../plugin-platform-contracts.js';

export type PluginCatalogIssueCode =
  | 'plugin_disabled'
  | 'plugin_incompatible_sdk_version'
  | 'plugin_incompatible_studio_version'
  | 'plugin_missing_host_capability'
  | 'plugin_missing_browser_entry'
  | 'plugin_module_missing'
  | 'plugin_module_mismatch';

export type PluginCatalogIssueSeverity = 'info' | 'error';

export type PluginCatalogIssue = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogSourceType;
  readonly sourceRef: string;
  readonly severity: PluginCatalogIssueSeverity;
  readonly code: PluginCatalogIssueCode;
  readonly message: string;
};

export const createIssue = (
  entry: PluginCatalogEntry,
  severity: PluginCatalogIssueSeverity,
  code: PluginCatalogIssueCode,
  message: string
): PluginCatalogIssue => ({
  pluginId: entry.pluginId,
  sourceType: entry.sourceType,
  sourceRef: entry.sourceRef,
  severity,
  code,
  message,
});
