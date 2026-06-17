import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const keycloakThemeCssPath = resolve(workspaceRoot, 'deploy/keycloak/themes/sva-kern2/theme/sva-kern2/login/resources/css/kern2.css');
const prefersColorSchemeDarkPattern = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;

describe('sva-kern2 keycloak login theme', () => {
  it('does not derive dark mode from browser or system preferences', () => {
    const cssSource = readFileSync(keycloakThemeCssPath, 'utf8');

    expect(cssSource).not.toMatch(prefersColorSchemeDarkPattern);
  });
});
