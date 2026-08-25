import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y.js';
import { ContextualHelp } from './ContextualHelp';

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ContextualHelp accessibility', () => {
  it('provides an accessible dialog and returns focus after Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: 'home.overview',
          markdown: '# Startseite\n\nEine kurze Hilfe.',
          documentationBaseUrl: 'https://docs.example.test/',
          websiteUrl: 'https://docs.example.test/pages/home.overview/',
        })
      )
    );
    render(<ContextualHelp pageId="home.overview" />);
    const trigger = screen.getByRole('button', { name: 'Hilfe öffnen' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Hilfe zu dieser Seite' });
    expect(screen.getByRole('button', { name: 'Hilfe schließen' })).toBeTruthy();
    await expect(expectNoA11yViolations(dialog)).resolves.toBeUndefined();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
