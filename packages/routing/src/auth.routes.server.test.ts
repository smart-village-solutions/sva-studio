import { describe, expect, it } from 'vitest';
import { authRoutePaths, resolveAuthHandlers } from './auth.routes.server';

describe('auth.routes.server', () => {
  it('resolves handlers for all declared auth paths', () => {
    for (const path of authRoutePaths) {
      expect(resolveAuthHandlers(path)).toBeDefined();
    }
  });

  it('throws for unknown auth path', () => {
    expect(() => resolveAuthHandlers('/auth/unknown')).toThrow('Unknown auth route path');
  });
});
