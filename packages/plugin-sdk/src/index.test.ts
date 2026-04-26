import { describe, expect, it } from 'vitest';

import {
  definePluginActions,
  pluginSdkPackageRoles,
  pluginSdkVersion,
  registerPluginTranslationResolver,
  translatePluginKey,
} from './index.js';

describe('@sva/plugin-sdk package scaffold', () => {
  it('declares the target package role', () => {
    expect(pluginSdkVersion).toBe('0.0.1');
    expect(pluginSdkPackageRoles).toContain('plugin-contracts');
  });

  it('exposes plugin contracts through the target package edge', () => {
    const actions = definePluginActions('news', [
      {
        id: 'news.create',
        titleKey: 'news.actions.create',
        requiredAction: 'content.create',
      },
    ]);

    expect(actions).toEqual([
      {
        id: 'news.create',
        titleKey: 'news.actions.create',
        requiredAction: 'content.create',
      },
    ]);
  });

  it('exposes plugin translation helpers through the target package edge', () => {
    registerPluginTranslationResolver((key) => (key === 'news.actions.create' ? 'News anlegen' : key));

    expect(translatePluginKey('news', 'actions.create')).toBe('News anlegen');
  });
});
