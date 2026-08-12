import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { buttonVariants } from '@sva/studio-ui-react';

type ThemeCase = Readonly<{
  id: 'default-light' | 'default-dark' | 'forest-light' | 'forest-dark';
  mode: 'light' | 'dark';
  theme: 'sva-default' | 'sva-forest';
}>;

const themeCases: readonly ThemeCase[] = [
  { id: 'default-light', mode: 'light', theme: 'sva-default' },
  { id: 'default-dark', mode: 'dark', theme: 'sva-default' },
  { id: 'forest-light', mode: 'light', theme: 'sva-forest' },
  { id: 'forest-dark', mode: 'dark', theme: 'sva-forest' },
];

const variantClasses = {
  primary: buttonVariants({ variant: 'primary' }),
  secondary: buttonVariants({ variant: 'secondary' }),
  tertiary: buttonVariants({ variant: 'tertiary' }),
  destructive: buttonVariants({ variant: 'destructive' }),
  icon: buttonVariants({ variant: 'tertiary', size: 'icon' }),
} as const;

const parseRgb = (value: string): readonly [number, number, number] => {
  const channels = value
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Could not parse computed color ${value}`);
  }

  return channels as [number, number, number];
};

const relativeLuminance = (color: readonly [number, number, number]) => {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (first: string, second: string) => {
  const [lighter, darker] = [
    relativeLuminance(parseRgb(first)),
    relativeLuminance(parseRgb(second)),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

const computedColors = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      color: style.color,
      opacity: style.opacity,
    };
  });

const renderButtonHarness = async (page: Page, themeCase: ThemeCase) => {
  await page.goto('/');
  await page.waitForFunction(() => document.styleSheets.length > 0);
  const compiledStyles = await page.evaluate(() =>
    Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules, (rule) => rule.cssText).join('\n');
        } catch {
          return '';
        }
      })
      .join('\n')
  );
  if (!compiledStyles.includes('--color-action-primary')) {
    throw new Error('The compiled Studio action-token styles could not be loaded.');
  }

  const harnessPage = await page.context().newPage();
  await harnessPage.emulateMedia({ reducedMotion: 'reduce' });
  const darkClass = themeCase.mode === 'dark' ? ' class="dark"' : '';

  await harnessPage.setContent(`
    <!doctype html>
    <html lang="de" data-theme="${themeCase.theme}" data-theme-mode="${themeCase.mode}"${darkClass}>
      <head><style>${compiledStyles}</style></head>
      <body>
        <main data-testid="button-harness" class="min-h-screen bg-background p-8 text-foreground">
          <h1 class="mb-6 text-2xl font-semibold">Studio Button Accessibility Matrix</h1>
          <div class="grid gap-6">
            ${[
              ['page', 'bg-background'],
              ['card', 'bg-card'],
              ['popover', 'bg-popover'],
            ]
              .map(
                ([surface, surfaceClass]) => `
                  <section data-surface="${surface}" class="${surfaceClass} rounded-lg border border-border p-6">
                    <h2 class="mb-4 text-lg font-medium">${surface}</h2>
                    <div class="flex flex-wrap items-center gap-3">
                      <button type="button" data-variant="primary" class="${variantClasses.primary}">Primary</button>
                      <button type="button" data-variant="secondary" class="${variantClasses.secondary}">Secondary</button>
                      <button type="button" data-variant="tertiary" class="${variantClasses.tertiary}">Tertiary</button>
                      <button type="button" data-variant="destructive" class="${variantClasses.destructive}">Destructive</button>
                      <button type="button" data-variant="disabled" class="${variantClasses.primary}" disabled>Disabled</button>
                      <button type="button" data-variant="icon" class="${variantClasses.icon}" aria-label="Bearbeiten">
                        <span aria-hidden="true">✎</span>
                      </button>
                    </div>
                  </section>
                `
              )
              .join('')}
          </div>
        </main>
      </body>
    </html>
  `);
  await expect(harnessPage.getByTestId('button-harness')).toBeVisible();
  await harnessPage.waitForFunction(() => {
    const harness = document.querySelector('[data-testid="button-harness"]');
    return (
      harness !== null && window.getComputedStyle(harness).backgroundColor !== 'rgba(0, 0, 0, 0)'
    );
  });
  return harnessPage;
};

for (const themeCase of themeCases) {
  test(`button matrix remains accessible in ${themeCase.id}`, async ({ page }) => {
    const harnessPage = await renderButtonHarness(page, themeCase);

    const harness = harnessPage.getByTestId('button-harness');
    const axeResults = await new AxeBuilder({ page: harnessPage })
      .include('[data-testid="button-harness"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    await harnessPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await harnessPage.keyboard.press('Tab');
    await expect(harness.locator('[data-surface="page"] [data-variant="primary"]')).toBeFocused();
    await harnessPage.keyboard.press('Tab');
    await harnessPage.keyboard.press('Tab');
    await harnessPage.keyboard.press('Tab');
    await harnessPage.keyboard.press('Tab');
    await expect(harness.locator('[data-surface="page"] [data-variant="icon"]')).toBeFocused();

    for (const surface of ['page', 'card', 'popover'] as const) {
      const section = harness.locator(`[data-surface="${surface}"]`);
      const surfaceBackground = (await computedColors(section)).backgroundColor;

      for (const variant of ['primary', 'secondary', 'tertiary', 'destructive'] as const) {
        const button = section.locator(`[data-variant="${variant}"]`);
        const bounds = await button.boundingBox();
        expect(bounds?.height, `${surface} ${variant} height`).toBeGreaterThanOrEqual(44);
        expect(bounds?.width, `${surface} ${variant} width`).toBeGreaterThanOrEqual(44);

        const normal = await computedColors(button);
        const normalBackground =
          variant === 'tertiary' ? surfaceBackground : normal.backgroundColor;
        expect(
          contrastRatio(normal.color, normalBackground),
          `${surface} ${variant} text contrast`
        ).toBeGreaterThanOrEqual(4.5);

        await button.hover();
        const hover = await computedColors(button);
        expect(
          contrastRatio(hover.color, hover.backgroundColor),
          `${surface} ${variant} hover contrast`
        ).toBeGreaterThanOrEqual(4.5);

        await harnessPage.mouse.down();
        const active = await computedColors(button);
        expect(
          contrastRatio(active.color, active.backgroundColor),
          `${surface} ${variant} active contrast`
        ).toBeGreaterThanOrEqual(4.5);
        await harnessPage.mouse.up();
      }

      const secondary = section.locator('[data-variant="secondary"]');
      const secondaryColors = await computedColors(secondary);
      expect(
        contrastRatio(secondaryColors.borderColor, surfaceBackground),
        `${surface} secondary border contrast`
      ).toBeGreaterThanOrEqual(3);

      const focused = section.locator('[data-variant="tertiary"]');
      await secondary.focus();
      await harnessPage.keyboard.press('Tab');
      await expect(focused).toBeFocused();
      const focusColors = await computedColors(focused);
      expect(focusColors.boxShadow).not.toBe('none');
      const focusRingColors = focusColors.boxShadow.match(/rgba?\([^)]*\)/gu) ?? [];
      expect(
        focusRingColors.some((color) => contrastRatio(color, surfaceBackground) >= 3),
        `${surface} focus ring contrast`
      ).toBe(true);

      const disabled = section.locator('[data-variant="disabled"]');
      const disabledColors = await computedColors(disabled);
      expect(disabledColors.opacity).toBe('1');
      expect(
        contrastRatio(disabledColors.color, disabledColors.backgroundColor)
      ).toBeGreaterThanOrEqual(4.5);

      const iconBounds = await section.locator('[data-variant="icon"]').boundingBox();
      expect(iconBounds?.height).toBeGreaterThanOrEqual(44);
      expect(iconBounds?.width).toBeGreaterThanOrEqual(44);
    }

    await expect(harness).toHaveScreenshot(`button-matrix-${themeCase.id}.png`, {
      animations: 'disabled',
    });
    await harnessPage.close();
  });
}
