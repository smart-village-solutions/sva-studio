import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const keycloakThemeCssPath = resolve(
  process.cwd(),
  'deploy/keycloak/themes/sva-kern2/theme/sva-kern2/login/resources/css/kern2.css'
);

describe('sva-kern2 keycloak login theme', () => {
  it('does not derive dark mode from browser or system preferences', () => {
    const cssSource = readFileSync(keycloakThemeCssPath, 'utf8');

    expect(cssSource).not.toContain('@media (prefers-color-scheme: dark)');
  });
});
