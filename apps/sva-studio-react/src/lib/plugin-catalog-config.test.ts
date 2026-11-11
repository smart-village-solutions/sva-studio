import { describe, expect, it } from 'vitest';
import { isValidPluginNamespace, pluginCatalogSourceTypes } from '@sva/plugin-sdk';

import {
  isInstalledPluginCatalogEntry,
  isWorkspacePluginCatalogEntry,
  parsePluginCatalogConfig,
} from './plugin-catalog-config';
import repositoryPluginCatalog from '../../plugin-catalog.json';

const workspaceEntry = {
  pluginId: 'news',
  sourceType: 'workspace',
  enabled: true,
  sourceRef: 'packages/plugin-news',
} as const;

const installedEntry = {
  pluginId: 'calendar',
  sourceType: 'installed-distribution',
  enabled: true,
  sourceRef: '@vendor/calendar',
  distribution: 'studio',
} as const;

const parseWith = (entry: unknown) => () => parsePluginCatalogConfig([workspaceEntry, entry]);

describe('parsePluginCatalogConfig', () => {
  it('accepts the repository plugin catalog', () => {
    expect(parsePluginCatalogConfig(repositoryPluginCatalog)).toHaveLength(
      repositoryPluginCatalog.length
    );
  });

  it('accepts every source type defined by the plugin SDK', () => {
    const entries = parsePluginCatalogConfig([
      workspaceEntry,
      installedEntry,
      { ...installedEntry, pluginId: 'maps', sourceType: 'linked-package', sourceRef: 'maps' },
    ]);
    expect(entries.map((entry) => entry.sourceType).sort()).toEqual(
      [...pluginCatalogSourceTypes].sort()
    );
    expect(entries.filter(isWorkspacePluginCatalogEntry).map(({ pluginId }) => pluginId)).toEqual([
      'news',
    ]);
    expect(entries.filter(isInstalledPluginCatalogEntry).map(({ pluginId }) => pluginId)).toEqual([
      'calendar',
      'maps',
    ]);
  });

  it('accepts the optional in-development availability flag', () => {
    expect(
      parsePluginCatalogConfig([{ ...workspaceEntry, availability: 'in-development' }])[0]
    ).toMatchObject({ availability: 'in-development' });
  });

  it.each(['calendar--tools', 'calendar-', 'c4', 'a'.repeat(31)])(
    'accepts the SDK-valid plugin id %s that the manifest and catalog contracts also accept',
    (pluginId) => {
      expect(isValidPluginNamespace(pluginId)).toBe(true);
      expect(parsePluginCatalogConfig([{ ...installedEntry, pluginId }])[0]?.pluginId).toBe(
        pluginId
      );
      expect(parsePluginCatalogConfig([{ ...workspaceEntry, pluginId }])[0]?.pluginId).toBe(
        pluginId
      );
    }
  );

  it('does not let an SDK-valid id on an unselected installed entry block the catalog', () => {
    const entries = parsePluginCatalogConfig([
      workspaceEntry,
      { ...installedEntry, pluginId: 'calendar--tools', distribution: 'ssf' },
    ]);
    expect(entries.filter(isInstalledPluginCatalogEntry).map(({ pluginId }) => pluginId)).toEqual([
      'calendar--tools',
    ]);
  });

  it.each([
    ['starts with a digit', '1calendar'],
    ['has a single character', 'a'],
    ['exceeds 31 characters', 'a'.repeat(32)],
    ['contains uppercase letters', 'Calendar'],
    ['contains a dot', 'calendar.tools'],
  ])('rejects a plugin id that %s like the SDK does', (_label, pluginId) => {
    expect(isValidPluginNamespace(pluginId)).toBe(false);
    expect(parseWith({ ...installedEntry, pluginId })).toThrow(
      `plugin_catalog_entry_invalid:${pluginId}:pluginId`
    );
  });

  it('rejects a plugin id with surrounding whitespace that would not match the manifest id', () => {
    expect(parseWith({ ...installedEntry, pluginId: ' calendar ' })).toThrow(
      'plugin_catalog_entry_invalid: calendar :pluginId'
    );
  });

  it('rejects a catalog that is not an array', () => {
    expect(() => parsePluginCatalogConfig({ entries: [] })).toThrow('plugin_catalog_invalid');
  });

  it.each([
    ['null', null],
    ['a string', 'news'],
    ['an array', ['news']],
  ])('rejects %s as a catalog entry and names its index', (_label, entry) => {
    expect(parseWith(entry)).toThrow('plugin_catalog_entry_invalid:#1');
  });

  it.each([
    ['a misspelled source type', 'installed-distrbution'],
    ['a differently cased source type', 'Workspace'],
    ['an unknown source type', 'remote'],
    ['a missing source type', undefined],
    ['a non-string source type', 42],
  ])('rejects %s and names the plugin', (_label, sourceType) => {
    expect(parseWith({ ...installedEntry, sourceType })).toThrow(
      'plugin_catalog_source_type_invalid:calendar'
    );
  });

  it.each([
    ['is missing', undefined],
    ['is empty', ''],
    ['is not a string', 7],
  ])('falls back to the entry index when the plugin id %s', (_label, pluginId) => {
    expect(parseWith({ ...installedEntry, sourceType: 'remote', pluginId })).toThrow(
      'plugin_catalog_source_type_invalid:#1'
    );
  });

  it.each([
    ['enabled as a string', { enabled: 'false' }, 'news:enabled'],
    ['a missing enabled flag', { enabled: undefined }, 'news:enabled'],
    ['a missing source reference', { sourceRef: undefined }, 'news:sourceRef'],
    ['an empty source reference', { sourceRef: '' }, 'news:sourceRef'],
    ['a parent directory source reference', { sourceRef: '../outside' }, 'news:sourceRef'],
    ['a nested parent directory reference', { sourceRef: 'packages/../../etc' }, 'news:sourceRef'],
    ['an absolute source reference', { sourceRef: '/etc/plugin' }, 'news:sourceRef'],
    ['a Windows drive source reference', { sourceRef: 'C:/plugin' }, 'news:sourceRef'],
    ['a backslash source reference', { sourceRef: 'packages\\plugin-news' }, 'news:sourceRef'],
    ['an unknown availability', { availability: 'beta' }, 'news:availability'],
    ['an unknown field', { enable: true }, 'news:enable'],
    ['a distribution', { distribution: 'studio' }, 'news:distribution'],
  ])('rejects a workspace entry with %s', (_label, override, location) => {
    expect(parseWith({ ...workspaceEntry, ...override })).toThrow(
      `plugin_catalog_entry_invalid:${location}`
    );
  });

  it('rejects an empty plugin id on an otherwise valid workspace entry by index', () => {
    expect(parseWith({ ...workspaceEntry, pluginId: '' })).toThrow(
      'plugin_catalog_entry_invalid:#1:pluginId'
    );
  });

  it.each([
    ['an invalid package name', { sourceRef: '../calendar' }, 'calendar:sourceRef'],
    ['a dot path segment', { sourceRef: '@vendor/..' }, 'calendar:sourceRef'],
    ['a missing distribution', { distribution: undefined }, 'calendar:distribution'],
    ['a custom distribution', { distribution: 'custom' }, 'calendar:distribution'],
    ['enabled as a string', { enabled: 'true' }, 'calendar:enabled'],
  ])('rejects an installed entry with %s', (_label, override, location) => {
    expect(parseWith({ ...installedEntry, ...override })).toThrow(
      `plugin_catalog_entry_invalid:${location}`
    );
  });
});
