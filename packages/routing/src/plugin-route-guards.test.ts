import { describe, expect, it } from 'vitest';
import type { PluginDefinition } from '@sva/plugin-sdk';
import { resolvePluginRouteGuard } from './plugin-route-guards.js';

describe('resolvePluginRouteGuard', () => {
  const plugin: PluginDefinition = {
    id: 'test',
    displayName: 'Test Plugin',
    permissions: [
      { id: 'test.read', titleKey: 'test.read.label' },
      { id: 'test.write', titleKey: 'test.write.label' },
    ],
    routes: [],
  };

  const route = { id: 'test-route', path: '/test', component: () => null as unknown };

  // Content guard mappings (legacy support)
  it('maps content guards to account UI guards', () => {
    const result = resolvePluginRouteGuard(plugin, { ...route, guard: 'content.read' }, undefined);
    expect(result).not.toBeNull();
  });

  // Empty/undefined guard
  it('returns null for undefined guard', () => {
    expect(resolvePluginRouteGuard(plugin, { ...route, guard: undefined }, undefined)).toBeNull();
  });

  it('returns null for empty guard', () => {
    expect(resolvePluginRouteGuard(plugin, { ...route, guard: '' }, undefined)).toBeNull();
  });

  it('returns null for whitespace guard', () => {
    expect(resolvePluginRouteGuard(plugin, { ...route, guard: '   ' }, undefined)).toBeNull();
  });

  // Guard trimming
  it('trims whitespace from guard', () => {
    const result = resolvePluginRouteGuard(plugin, { ...route, guard: '  test.read  ' }, undefined);
    expect(result).not.toBeNull();
  });

  // Pattern validation
  it('rejects invalid pattern', () => {
    expect(resolvePluginRouteGuard(plugin, { ...route, guard: 'InvalidPattern' }, undefined)).toBeNull();
  });

  it('rejects guard without registration', () => {
    expect(resolvePluginRouteGuard(plugin, { ...route, guard: 'other.action' }, undefined)).toBeNull();
  });

  // Valid permissions
  it('creates guard for registered permission', () => {
    const result = resolvePluginRouteGuard(plugin, { ...route, guard: 'test.read' }, undefined);
    expect(result).not.toBeNull();
  });

  it('creates guard for another registered permission', () => {
    const result = resolvePluginRouteGuard(plugin, { ...route, guard: 'test.write' }, undefined);
    expect(result).not.toBeNull();
  });

  // Edge cases
  it('handles plugin without permissions', () => {
    const noPerms: PluginDefinition = {
      ...plugin,
      permissions: undefined,
    };
    expect(resolvePluginRouteGuard(noPerms, { ...route, guard: 'test.read' }, undefined)).toBeNull();
  });

  it('handles empty permissions array', () => {
    const emptyPerms: PluginDefinition = {
      ...plugin,
      permissions: [],
    };
    expect(resolvePluginRouteGuard(emptyPerms, { ...route, guard: 'test.read' }, undefined)).toBeNull();
  });

  // Permission ID trimming
  it('matches permission with whitespace in id', () => {
    const whitespacePerms: PluginDefinition = {
      ...plugin,
      permissions: [{ id: ' test.read ', titleKey: 'label' }],
    };
    const result = resolvePluginRouteGuard(
      whitespacePerms,
      { ...route, guard: 'test.read' },
      undefined
    );
    expect(result).not.toBeNull();
  });

  // Hyphens in permission names
  it('accepts hyphenated permission names', () => {
    const hyphenated: PluginDefinition = {
      ...plugin,
      permissions: [{ id: 'my-plugin.read', titleKey: 'label' }],
    };
    const result = resolvePluginRouteGuard(
      hyphenated,
      { ...route, guard: 'my-plugin.read' },
      undefined
    );
    expect(result).not.toBeNull();
  });
});
