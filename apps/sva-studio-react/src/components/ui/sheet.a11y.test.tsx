import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '@/test/a11y';

import { Sheet, SheetContent } from './sheet';

afterEach(() => {
  cleanup();
});

describe('ui/sheet accessibility', () => {
  it.each([
    { label: 'with description', description: 'Hauptnavigation der Anwendung' },
    { label: 'without description', description: undefined },
  ])('renders an accessible named sheet $label', async ({ description }) => {
    render(
      <Sheet open onOpenChange={vi.fn()}>
        <SheetContent aria-label="Navigation" closeLabel="Schließen" description={description}>
          <nav aria-label="Bereiche">
            <a href="/inhalte">Inhalte</a>
          </nav>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'Navigation', description: description ?? '' });

    expect(dialog.hasAttribute('aria-describedby')).toBe(Boolean(description));
    await expect(expectNoA11yViolations(dialog)).resolves.toBeUndefined();
  });
});
