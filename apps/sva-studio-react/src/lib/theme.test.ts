import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_NAME, getThemeDisplayName, resolveThemeMode, resolveThemeName } from './theme';

describe('theme helpers', () => {
  it('keeps stable internal theme ids during the KERN phase-1 reskin', () => {
    expect(DEFAULT_THEME_NAME).toBe('sva-default');
    expect(resolveThemeName('11111111-1111-1111-8111-111111111111')).toBe('sva-forest');
  });

  it('resolves a known instanceId to its theme variant', () => {
    expect(resolveThemeName('11111111-1111-1111-8111-111111111111')).toBe('sva-forest');
  });

  it('falls back to the default theme when no instanceId is available', () => {
    expect(resolveThemeName(undefined)).toBe(DEFAULT_THEME_NAME);
    expect(resolveThemeName('unknown-instance')).toBe(DEFAULT_THEME_NAME);
  });

  it('prefers persisted theme mode over system preference', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark');
    expect(resolveThemeMode('light', true)).toBe('light');
  });

  it('uses system preference when no persisted theme mode exists', () => {
    expect(resolveThemeMode(null, true)).toBe('dark');
    expect(resolveThemeMode(undefined, false)).toBe('light');
  });

  it('uses KERN-facing display names for the shell toggle and metadata', () => {
    expect(getThemeDisplayName('sva-default')).toBe('KERN Studio');
    expect(getThemeDisplayName('sva-forest')).toBe('KERN Studio Wald');
  });
});
