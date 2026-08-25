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
        documentationBaseUrl: 'https://docs.example.test/',
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
          documentationBaseUrl: 'https://docs.example.test/',
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

  it('rejects malformed payloads without rendering remote content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: 'another.page',
          markdown: '# Falsche Seite',
          documentationBaseUrl: 'https://docs.example.test/',
          websiteUrl: 'https://docs.example.test/pages/another.page/',
        })
      )
    );

    render(<ContextualHelp pageId="home.overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(
      await screen.findByText('Hilfe ist vorübergehend nicht verfügbar')
    ).toBeTruthy();
    expect(screen.queryByText('Falsche Seite')).toBeNull();
  });

  it('filters unsafe markdown links and images while retaining allowed targets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: 'home.overview',
          markdown: [
            '## Verweise',
            '',
            '[E-Mail](mailto:hilfe@example.test)',
            '',
            '[Unsicher](javascript:alert(1))',
            '',
            '![Intern](../media/hilfe.png)',
            '',
            '![Extern](https://other.example.test/hilfe.png)',
            '',
            '![Außerhalb](/anderes-projekt/hilfe.png)',
          ].join('\n'),
          documentationBaseUrl: 'https://docs.example.test/studio/',
          websiteUrl: 'https://docs.example.test/studio/pages/home.overview/',
        })
      )
    );

    render(<ContextualHelp pageId="home.overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(await screen.findByRole('heading', { name: 'Verweise' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'E-Mail' }).getAttribute('href')).toBe(
      'mailto:hilfe@example.test'
    );
    expect(screen.queryByRole('link', { name: 'Unsicher' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Intern' }).getAttribute('src')).toBe(
      'https://docs.example.test/studio/pages/media/hilfe.png'
    );
    expect(screen.queryByRole('img', { name: 'Extern' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Außerhalb' })).toBeNull();
  });

  it('shows an explicit empty state for blank markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: 'home.overview',
          markdown: '   ',
          documentationBaseUrl: 'https://docs.example.test/',
          websiteUrl: 'https://docs.example.test/pages/home.overview/',
        })
      )
    );

    render(<ContextualHelp pageId="home.overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(
      await screen.findByText('Für diese Seite ist noch kein Hilfetext hinterlegt.')
    ).toBeTruthy();
  });
});
