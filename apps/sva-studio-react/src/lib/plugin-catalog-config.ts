import {
  isValidPluginNamespace,
  pluginCatalogSourceTypes,
  type PluginCatalogSourceType,
} from '@sva/plugin-sdk';
import { z } from 'zod';

// Same rule the SDK applies to manifest and catalog plugin ids, so every id the platform can
// load passes. The exact value is checked: the installed resolver compares it to the manifest id.
const pluginIdSchema = z.string().refine(isValidPluginNamespace);

const isWorkspaceRelativePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !/^[a-zA-Z]:/u.test(path) &&
  path.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');

const isPackageName = (name: string): boolean =>
  /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(name) &&
  name.split('/').every((part) => part !== '.' && part !== '..');

const sharedEntryFields = {
  pluginId: pluginIdSchema,
  enabled: z.boolean(),
  availability: z.literal('in-development').optional(),
};

const workspaceEntrySchema = z.strictObject({
  ...sharedEntryFields,
  sourceType: z.literal('workspace'),
  sourceRef: z.string().refine(isWorkspaceRelativePath),
});

const installedEntrySchema = z.strictObject({
  ...sharedEntryFields,
  sourceType: z.enum(['installed-distribution', 'linked-package']),
  sourceRef: z.string().refine(isPackageName),
  distribution: z.enum(['studio', 'ssf']),
});

export type WorkspacePluginCatalogConfigEntry = z.infer<typeof workspaceEntrySchema>;
export type InstalledPluginCatalogConfigEntry = z.infer<typeof installedEntrySchema>;
export type PluginCatalogConfigEntry =
  WorkspacePluginCatalogConfigEntry | InstalledPluginCatalogConfigEntry;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isKnownSourceType = (value: unknown): value is PluginCatalogSourceType =>
  (pluginCatalogSourceTypes as readonly unknown[]).includes(value);

const describeIssue = (issue: z.core.$ZodIssue): string =>
  issue.code === 'unrecognized_keys' ? issue.keys.join(',') : issue.path.join('.');

const parseEntry = (value: unknown, index: number): PluginCatalogConfigEntry => {
  if (!isRecord(value)) throw new Error(`plugin_catalog_entry_invalid:#${index}`);
  const label =
    typeof value.pluginId === 'string' && value.pluginId.length > 0 ? value.pluginId : `#${index}`;
  if (!isKnownSourceType(value.sourceType)) {
    throw new Error(`plugin_catalog_source_type_invalid:${label}`);
  }
  const result = (
    value.sourceType === 'workspace' ? workspaceEntrySchema : installedEntrySchema
  ).safeParse(value);
  if (!result.success) {
    const [issue] = result.error.issues;
    throw new Error(`plugin_catalog_entry_invalid:${label}:${issue ? describeIssue(issue) : ''}`);
  }
  return result.data;
};

/**
 * Validates the raw `plugin-catalog.json` content. Every build and CI consumer of the
 * catalog must read it through this parser, so an invalid entry fails with the same
 * labelled error regardless of which consumer runs first.
 */
export const parsePluginCatalogConfig = (value: unknown): readonly PluginCatalogConfigEntry[] => {
  if (!Array.isArray(value)) throw new Error('plugin_catalog_invalid');
  return value.map(parseEntry);
};

export const isWorkspacePluginCatalogEntry = (
  entry: PluginCatalogConfigEntry
): entry is WorkspacePluginCatalogConfigEntry => entry.sourceType === 'workspace';

export const isInstalledPluginCatalogEntry = (
  entry: PluginCatalogConfigEntry
): entry is InstalledPluginCatalogConfigEntry => entry.sourceType !== 'workspace';
