import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const keycloakThemeCssPath = resolve(
  workspaceRoot,
  'deploy/keycloak/themes/sva-kern2/theme/sva-kern2/login/resources/css/kern2.css'
);
const prefersColorSchemeDarkPattern = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;

type RgbColor = Readonly<{ blue: number; green: number; red: number }>;

const parseHexColor = (hexColor: string): RgbColor => ({
  red: Number.parseInt(hexColor.slice(1, 3), 16),
  green: Number.parseInt(hexColor.slice(3, 5), 16),
  blue: Number.parseInt(hexColor.slice(5, 7), 16),
});

const relativeLuminance = (hexColor: string): number => {
  const { red, green, blue } = parseHexColor(hexColor);
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((channel) => {
    const normalizedChannel = channel / 255;

    return normalizedChannel <= 0.04045
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
};

const contrastRatio = (firstColor: string, secondColor: string): number => {
  const lighter = Math.max(relativeLuminance(firstColor), relativeLuminance(secondColor));
  const darker = Math.min(relativeLuminance(firstColor), relativeLuminance(secondColor));

  return (lighter + 0.05) / (darker + 0.05);
};

const extractRootDeclarations = (cssSource: string, mode: 'dark' | 'light'): string => {
  const pattern =
    mode === 'light'
      ? /^\s*:root\s*\{(?<declarations>[^}]*)\}/u
      : /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{[\s\S]*?:root\s*\{(?<declarations>[^}]*)\}/iu;
  const declarations = cssSource.match(pattern)?.groups?.declarations;

  expect(declarations, `${mode} root declarations`).toBeDefined();

  return declarations as string;
};

const extractHexToken = (declarations: string, tokenName: string): string => {
  const escapedTokenName = tokenName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const value = declarations.match(
    new RegExp(`${escapedTokenName}:\\s*(#[0-9a-f]{6})\\s*;`, 'iu')
  )?.[1];

  expect(value, tokenName).toBeDefined();

  return value as string;
};

describe('sva-kern2 keycloak login theme', () => {
  it('follows the browser or system color-scheme preference with light as fallback', () => {
    const cssSource = readFileSync(keycloakThemeCssPath, 'utf8');

    expect(cssSource).toMatch(/^\s*:root\s*\{[\s\S]*?color-scheme:\s*light;/u);
    expect(cssSource).toMatch(prefersColorSchemeDarkPattern);
    expect(cssSource).toMatch(
      /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{[\s\S]*?color-scheme:\s*dark;/iu
    );
  });

  it.each(['light', 'dark'] as const)('meets WCAG contrast contracts in %s mode', (mode) => {
    const cssSource = readFileSync(keycloakThemeCssPath, 'utf8');
    const declarations = extractRootDeclarations(cssSource, mode);
    const surface = extractHexToken(declarations, '--sva-kern2-surface');
    const inputBackground = extractHexToken(declarations, '--sva-kern2-input-background');
    const textPairs = [
      ['--sva-kern2-text', surface],
      ['--sva-kern2-text-muted', surface],
      ['--sva-kern2-primary', surface],
      ['--sva-kern2-input-text', inputBackground],
      ['--sva-kern2-input-placeholder', inputBackground],
      ['--sva-kern2-button-text', extractHexToken(declarations, '--sva-kern2-button-background')],
      ['--sva-kern2-danger', extractHexToken(declarations, '--sva-kern2-danger-background')],
      ['--sva-kern2-success', extractHexToken(declarations, '--sva-kern2-success-background')],
    ] as const;

    for (const [foregroundToken, background] of textPairs) {
      expect(
        contrastRatio(extractHexToken(declarations, foregroundToken), background),
        foregroundToken
      ).toBeGreaterThanOrEqual(4.5);
    }

    expect(
      contrastRatio(extractHexToken(declarations, '--sva-kern2-surface-border'), surface),
      '--sva-kern2-surface-border'
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(extractHexToken(declarations, '--sva-kern2-focus'), inputBackground),
      '--sva-kern2-focus'
    ).toBeGreaterThanOrEqual(3);
  });

  it('styles the current keycloak.v2 markup and browser autofill explicitly', () => {
    const cssSource = readFileSync(keycloakThemeCssPath, 'utf8');

    expect(cssSource).toMatch(/body#keycloak-bg/u);
    expect(cssSource).toMatch(/\.pf-v5-c-form-control\s*>\s*input/u);
    expect(cssSource).toMatch(/input:-webkit-autofill/u);
    expect(cssSource).toMatch(/-webkit-text-fill-color:\s*var\(--sva-kern2-input-text\)/u);
    expect(cssSource).toMatch(/button\[data-password-toggle\]/u);
  });
});
