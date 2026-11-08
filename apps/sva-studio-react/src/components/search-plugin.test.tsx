import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { q: 'city', types: [], categories: [], provider: '', page: 1 } as {
    q: string;
    types: string[];
    categories: string[];
    provider: string;
    page: number;
  },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  useSearch: () => state.search,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { SearchHeader, SearchResultsPage } from '@sva/plugin-search';
registerPluginTranslationResolver((key, vars) =>
  vars ? key + ' ' + Object.values(vars).join(' ') : key
);
beforeEach(() => {
  state.search = { q: 'city', types: [], categories: [], provider: '', page: 1 };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const data = {
  items: [
    {
      id: '42',
      contentType: 'news.article',
      title: 'Allowed city article',
      excerpt: 'Safe preview',
      href: '/admin/news/42',
      providerId: '1',
      providerName: 'Provider',
      categories: ['Culture'],
    },
  ],
  allowed: 20,
  denied: 30,
  unresolved: 0,
  complete: true,
  hasNextPage: false,
  options: {
    types: ['news.article'],
    categories: ['Culture'],
    providers: [{ id: '1', name: 'Provider' }],
  },
};
describe('search interface', () => {
  it('submits the header query and offers the mobile entry', () => {
    const onSearch = vi.fn();
    render(<SearchHeader onSearch={onSearch} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' city ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(onSearch).toHaveBeenCalledWith('city');
    fireEvent.click(screen.getByRole('button', { name: 'search.open' }));
    expect(onSearch).toHaveBeenLastCalledWith('');
  });
  it('shows exact allowed and denied counts with safe accessible detail links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ data }))
    );
    render(<SearchResultsPage contextKey="org1" />);
    expect(
      (await screen.findByRole('link', { name: 'Allowed city article' })).getAttribute('href')
    ).toBe('/admin/news/42');
    expect(screen.getByRole('status').textContent).toContain('20 30');
    expect(screen.getByLabelText('search.provider')).toBeTruthy();
    expect(screen.queryByText('search.incomplete')).toBeNull();
  });
  it('distinguishes incomplete counts from final counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ data: { ...data, items: [], complete: false, unresolved: 2 } })
        )
    );
    render(<SearchResultsPage />);
    expect(await screen.findByText('search.incomplete')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('search.available');
    expect(screen.getByRole('status').textContent).not.toContain('search.count');
    expect(screen.queryByText('search.empty')).toBeNull();
  });
  it('discards responses from an old access context', async () => {
    let resolveOld!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockImplementation(async () => Response.json({ data: { ...data, items: [] } }));
    vi.stubGlobal('fetch', fetcher);
    const view = render(<SearchResultsPage key="org1" contextKey="org1" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    view.rerender(<SearchResultsPage key="org2" contextKey="org2" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    resolveOld(Response.json({ data }));
    await screen.findByText('search.empty');
    expect(screen.queryByText('Allowed city article')).toBeNull();
  });
});

it('keeps further type selections available after the first filter is applied', async () => {
  const options = { ...data.options, types: ['news.article', 'events.event-record'] };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => Response.json({ data: { ...data, options } }))
  );
  const view = render(<SearchResultsPage contextKey="org" />);
  await screen.findByRole('link', { name: 'Allowed city article' });
  fireEvent.click(screen.getByLabelText('search.type'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'search.types.news' }));
  expect(state.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      search: expect.objectContaining({ types: ['news.article'], page: 1 }),
    })
  );
  state.search = { ...state.search, types: ['news.article'] };
  view.rerender(<SearchResultsPage contextKey="org" />);
  await waitFor(() => expect(screen.queryByText('search.loading')).toBeNull());
  const trigger = screen.getByLabelText('search.type');
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'search.types.events' }));
  expect(state.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      search: expect.objectContaining({ types: ['news.article', 'events.event-record'] }),
    })
  );
});
