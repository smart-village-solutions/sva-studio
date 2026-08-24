import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContextualHelp } from './ContextualHelp';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ContextualHelp', () => {
  it('loads the page only after opening and renders safe markdown', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: 'home.overview',
        markdown:
          '# Startseite\n\n[Mehr](https://docs.example.test/guide)\n\n<script>alert(1)</script>',
        websiteUrl: 'https://docs.example.test/pages/home.overview/',
      })
    );
    vi.stubGlobal('fetch', request);

    render(<ContextualHelp pageId="home.overview" />);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(await screen.findByRole('heading', { name: 'Startseite' })).toBeTruthy();
    expect(screen.queryByText('alert(1)')).toBeNull();
    expect(screen.getByRole('link', { name: 'Mehr' }).getAttribute('href')).toBe(
      'https://docs.example.test/guide'
    );
    expect(request).toHaveBeenCalledWith(
      '/api/studio/documentation/home.overview',
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  it('keeps a failed help request non-blocking and retries on demand', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          id: 'home.overview',
          markdown: '# Wieder da',
          websiteUrl: 'https://docs.example.test/pages/home.overview/',
        })
      );
    vi.stubGlobal('fetch', request);

    render(<ContextualHelp pageId="home.overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));
    expect(
      await screen.findByText('Hilfe ist vorübergehend nicht verfügbar')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(screen.getByText('Wieder da')).toBeTruthy());
    expect(request).toHaveBeenCalledTimes(2);
  });
});
