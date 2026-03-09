import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_NAME, getThemeDisplayName, resolveThemeMode, resolveThemeName } from './theme';

describe('theme helpers', () => {
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

  it('returns a stable display name for known themes', () => {
    expect(getThemeDisplayName('sva-default')).toBe('SVA Studio');
    expect(getThemeDisplayName('sva-forest')).toBe('SVA Forest');
  });
});
