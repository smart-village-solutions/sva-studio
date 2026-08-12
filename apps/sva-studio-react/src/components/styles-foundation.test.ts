import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function resolveStylesPath(): string {
  const candidatePaths = [
    resolve(process.cwd(), 'src/styles.css'),
    resolve(process.cwd(), 'apps/sva-studio-react/src/styles.css'),
  ];

  const stylesPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));

  if (!stylesPath) {
    throw new Error(`Could not resolve styles.css from cwd ${process.cwd()}`);
  }

  return stylesPath;
}

const stylesSource = readFileSync(resolveStylesPath(), 'utf8');

type Rgb = readonly [number, number, number];
type ThemeTokens = Readonly<Record<string, Rgb>>;

const extractRuleTokens = (selector: string): ThemeTokens => {
  const ruleStart = stylesSource.indexOf(`${selector} {`);
  if (ruleStart === -1) {
    throw new Error(`Could not find CSS rule for ${selector}`);
  }

  const bodyStart = stylesSource.indexOf('{', ruleStart) + 1;
  const bodyEnd = stylesSource.indexOf('}', bodyStart);
  const declarations = stylesSource.slice(bodyStart, bodyEnd);
  const tokens: Record<string, Rgb> = {};

  for (const match of declarations.matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }

  return tokens;
};

const rootTokens = extractRuleTokens(':root');
const forestTokens = extractRuleTokens("html[data-theme='sva-forest']");
const darkTokens = extractRuleTokens("html.dark,\n  html[data-theme-mode='dark']");
const forestDarkTokens = extractRuleTokens(
  "html[data-theme='sva-forest'].dark,\n  html[data-theme='sva-forest'][data-theme-mode='dark']"
);

const themeTokens = {
  'default-light': rootTokens,
  'default-dark': { ...rootTokens, ...darkTokens },
  'forest-light': { ...rootTokens, ...forestTokens },
  'forest-dark': { ...rootTokens, ...darkTokens, ...forestDarkTokens },
} satisfies Record<string, ThemeTokens>;

const relativeLuminance = ([red, green, blue]: Rgb) => {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (first: Rgb, second: Rgb) => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (left, right) => right - left
  );

  return (lighter + 0.05) / (darker + 0.05);
};

const requireToken = (tokens: ThemeTokens, token: string): Rgb => {
  const value = tokens[token];
  if (!value) {
    throw new Error(`Missing CSS token --${token}`);
  }

  return value;
};

describe('styles foundation tokens', () => {
  it('binds Tailwind dark variants to the Studio theme class', () => {
    expect(stylesSource).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  });

  it('maps the default shell action tokens to a KERN-blue palette', () => {
    expect(stylesSource).toContain('--primary: 0 90 158;');
    expect(stylesSource).toContain('--ring: 0 90 158;');
    expect(stylesSource).toContain('--sidebar-primary: 0 90 158;');
    expect(stylesSource).toContain('--sidebar-accent: 233 240 249;');
    expect(stylesSource).toContain('--waste-panel-surface: 240 244 249;');
  });

  it('keeps the forest theme as an explicit green variant over the default blue base', () => {
    expect(stylesSource).toContain("html[data-theme='sva-forest'] {");
    expect(stylesSource).toContain('--primary: 18 122 96;');
    expect(stylesSource).toContain('--sidebar-primary: 18 122 96;');
  });

  it.each(Object.entries(themeTokens))(
    'keeps active button text at WCAG AA contrast in %s',
    (_theme, tokens) => {
      const textPairs = [
        ['action-primary-foreground', 'action-primary'],
        ['action-primary-foreground', 'action-primary-hover'],
        ['action-primary-foreground', 'action-primary-active'],
        ['action-secondary-foreground', 'action-secondary'],
        ['action-secondary-foreground', 'action-secondary-hover'],
        ['action-secondary-foreground', 'action-secondary-active'],
        ['action-tertiary-hover-foreground', 'action-tertiary-hover'],
        ['action-tertiary-active-foreground', 'action-tertiary-active'],
        ['action-destructive-foreground', 'action-destructive'],
        ['action-destructive-foreground', 'action-destructive-hover'],
        ['action-destructive-foreground', 'action-destructive-active'],
        ['action-disabled-foreground', 'action-disabled'],
      ] as const;

      for (const [foreground, background] of textPairs) {
        expect(
          contrastRatio(requireToken(tokens, foreground), requireToken(tokens, background)),
          `${foreground} on ${background}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it.each(Object.entries(themeTokens))(
    'keeps transparent tertiary text and focus indicators visible in %s',
    (_theme, tokens) => {
      const surfaces = ['background', 'card', 'popover'] as const;

      for (const surface of surfaces) {
        expect(
          contrastRatio(
            requireToken(tokens, 'action-tertiary-foreground'),
            requireToken(tokens, surface)
          ),
          `tertiary text on ${surface}`
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(requireToken(tokens, 'action-focus'), requireToken(tokens, surface)),
          `focus ring on ${surface}`
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrastRatio(
            requireToken(tokens, 'action-secondary-border'),
            requireToken(tokens, surface)
          ),
          `secondary border on ${surface}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it('uses tighter radii for larger shell surfaces while keeping small controls differentiated', () => {
    expect(stylesSource).toContain('--radius: 6px;');
    expect(stylesSource).toContain('--radius-card: 8px;');
    expect(stylesSource).toContain('--radius-modal: 12px;');
  });

  it('marks invalid form controls and pulses the error shadow exactly five times', () => {
    expect(stylesSource).toContain("[aria-invalid='true']");
    expect(stylesSource).toContain('border-color: rgb(var(--destructive));');
    expect(stylesSource).toContain('animation: validation-error-pulse 520ms ease-out 5;');
  });
});
