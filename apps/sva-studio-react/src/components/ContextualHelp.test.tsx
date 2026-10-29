import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioPageTitle } from '@sva/studio-ui-react';

import { ContextualHelpBoundary } from './ContextualHelpBoundary';

const renderContextualHelp = async (pageId = 'home.overview') => {
  render(
    <ContextualHelpBoundary pageId={pageId}>
      <StudioPageTitle withAccessory>Start</StudioPageTitle>
    </ContextualHelpBoundary>
  );
  await vi.dynamicImportSettled();
};

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ContextualHelp', () => {
  it('loads the page only after opening and renders safe markdown', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: 'home.overview',
        markdown:
          '---\nid: home.overview\ntitle: Startseite\npageType: overview\n---\n\n# Startseite\n\n[Mehr](https://docs.example.test/guide)\n\n<script>alert(1)</script>',
        documentationBaseUrl: 'https://docs.example.test/',
        websiteUrl: 'https://docs.example.test/pages/home.overview/',
      })
    );
    vi.stubGlobal('fetch', request);

    await renderContextualHelp();
    expect(request).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Öffnen Sie die passende Anwenderdokumentation direkt im Studio.')
    ).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Hilfe öffnen' });
    expect(trigger.className).toContain('h-11');
    expect(trigger.className).toContain('w-11');
    fireEvent.click(trigger);

    expect(await screen.findByRole('heading', { name: 'Startseite' })).toBeTruthy();
    expect(screen.queryByText(/id: home\.overview/u)).toBeNull();
    expect(screen.queryByText(/pageType: overview/u)).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByText('alert(1)')).toBeNull();
    expect(screen.getByRole('link', { name: 'Mehr' }).getAttribute('href')).toBe(
      'https://docs.example.test/guide'
    );
    const editLink = screen.getByRole('link', { name: 'Auf GitHub bearbeiten' });
    expect(editLink.getAttribute('href')).toBe(
      'https://github.com/smart-village-solutions/sva-studio-user-documentation/edit/main/docs/pages/home.overview.md'
    );
    expect(editLink.getAttribute('target')).toBe('_blank');
    expect(editLink.getAttribute('rel')).toBe('noopener noreferrer');
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

    await renderContextualHelp();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));
    expect(await screen.findByText('Hilfe ist vorübergehend nicht verfügbar')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Auf GitHub bearbeiten' })).toBeNull();
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

    await renderContextualHelp();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(await screen.findByText('Hilfe ist vorübergehend nicht verfügbar')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Auf GitHub bearbeiten' })).toBeNull();
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
            '[Kategorien pflegen](/guides/kategorien-pflegen)',
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

    await renderContextualHelp();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(await screen.findByRole('heading', { name: 'Verweise' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'E-Mail' }).getAttribute('href')).toBe(
      'mailto:hilfe@example.test'
    );
    expect(screen.getByRole('link', { name: 'Kategorien pflegen' }).getAttribute('href')).toBe(
      'https://docs.example.test/studio/guides/kategorien-pflegen'
    );
    expect(screen.queryByRole('link', { name: 'Unsicher' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Intern' }).getAttribute('src')).toBe(
      'https://docs.example.test/studio/pages/media/hilfe.png'
    );
    expect(screen.queryByRole('img', { name: 'Extern' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Außerhalb' })).toBeNull();
  });

  it('links an empty nested page to its own GitHub source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: 'admin.users.detail',
          markdown: '   ',
          documentationBaseUrl: 'https://docs.example.test/',
          websiteUrl: 'https://docs.example.test/pages/home.overview/',
        })
      )
    );

    await renderContextualHelp('admin.users.detail');
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe öffnen' }));

    expect(
      await screen.findByText('Für diese Seite ist noch kein Hilfetext hinterlegt.')
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Auf GitHub bearbeiten' }).getAttribute('href')).toBe(
      'https://github.com/smart-village-solutions/sva-studio-user-documentation/edit/main/docs/pages/admin.users.detail.md'
    );
  });
});
