/** User-visible release states and the untrusted Markdown boundary. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../providers/locale-provider', () => ({ useLocale: () => ({ locale: 'de' }) }));
import { ChangelogPage } from './-changelog-page';
import { t } from '../i18n';

const release = {
  tag: 'studio-v1.4.0',
  name: 'Studio 1.4.0',
  publishedAt: '2026-11-13T17:57:57Z',
  body: '## Verbesserungen\n\nNeu für die Redaktion.',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChangelogPage', () => {
  it('shows loading, release metadata, notes and source links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([release])));
    render(<ChangelogPage />);
    expect(screen.getByRole('status').textContent).toBe(t('shell.changelog.loading'));
    await screen.findByRole('heading', { name: 'Studio 1.4.0', level: 2 });
    expect(screen.getByRole('heading', { name: 'Verbesserungen', level: 3 })).toBeTruthy();
    expect(screen.getByText('Neu für die Redaktion.')).toBeTruthy();
    expect(screen.getByText('13. November 2026').getAttribute('datetime')).toBe(
      release.publishedAt
    );
    expect(
      screen.getByRole('link', { name: t('shell.changelog.source') }).getAttribute('href')
    ).toBe('https://github.com/smart-village-solutions/sva-studio/releases/tag/studio-v1.4.0');
  });

  it('keeps raw HTML, unsafe links and tracking images out of release notes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json([
          {
            ...release,
            body: '<script>window.evil=true</script>\n\n![tracker](https://tracker.test/a.png)\n\n[bad](javascript:alert%281%29) [good](https://example.test/docs) [relative](../studio-v1.3.0)',
          },
        ])
      )
    );
    const { container } = render(<ChangelogPage />);
    await screen.findByRole('heading', { name: 'Studio 1.4.0' });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
    expect(screen.getByRole('link', { name: 'good' }).getAttribute('rel')).toBe(
      'noopener noreferrer'
    );
    expect(screen.getByRole('link', { name: 'relative' }).getAttribute('href')).toBe(
      'https://github.com/smart-village-solutions/sva-studio/releases/studio-v1.3.0'
    );
  });

  it('shows an empty state and a fallback for missing notes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ ...release, body: '' }]));
    vi.stubGlobal('fetch', fetchMock);
    const first = render(<ChangelogPage />);
    await screen.findByText(t('shell.changelog.empty'));
    first.unmount();
    render(<ChangelogPage />);
    await screen.findByText(t('shell.changelog.noNotes'));
  });

  it('shows a controlled error and can retry successfully', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(Response.json([release]));
    vi.stubGlobal('fetch', fetchMock);
    render(<ChangelogPage />);
    expect((await screen.findByRole('alert')).textContent).toBe(t('shell.changelog.error'));
    fireEvent.click(screen.getByRole('button', { name: t('shell.changelog.retry') }));
    await screen.findByRole('heading', { name: 'Studio 1.4.0' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed server data and aborts requests on unmount', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json([{ ...release, publishedAt: 'invalid' }]));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ChangelogPage />);
    await screen.findByRole('alert');
    view.unmount();
    await waitFor(() => expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true));
  });
});
