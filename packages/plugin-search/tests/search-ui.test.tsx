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
import { SearchHeader, SearchResultsPage } from '../src/index.js';
import { SearchFilters } from '../src/search-filters.js';
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
  it('distinguishes global and results search landmarks when both are visible', () => {
    state.search = { ...state.search, q: '' };
    render(
      <>
        <SearchHeader onSearch={vi.fn()} />
        <SearchResultsPage />
      </>
    );
    expect(screen.getByRole('search', { name: 'search.headerLandmark' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'search.resultsLandmark' })).toBeTruthy();
  });
  it('waits for a search term and preserves filters when submitting a new term', () => {
    state.search = { ...state.search, q: '', categories: ['Culture'] };
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<SearchResultsPage />);
    expect(screen.getByRole('status').textContent).toBe('search.initial');
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' new city ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(state.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ q: 'new city', categories: ['Culture'], page: 1 }),
      })
    );
  });
  it.each([
    ['search_not_configured', 'search.notConfigured'],
    ['search_context_changed', 'search.contextChanged'],
    ['search_unavailable', 'search.error'],
  ])('recovers from %s without displaying a raw server error', async (error, message) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error }, { status: 503 }))
      .mockImplementation(async () => Response.json({ data }));
    vi.stubGlobal('fetch', fetcher);
    render(<SearchResultsPage />);
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    fireEvent.click(screen.getByRole('button', { name: 'search.retry' }));
    await screen.findByRole('link', { name: 'Allowed city article' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries incomplete scans and navigates result pages with the current filters', async () => {
    state.search = { ...state.search, page: 2, provider: '1' };
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ data: { ...data, complete: false, hasNextPage: true } })
      );
    vi.stubGlobal('fetch', fetcher);
    render(<SearchResultsPage />);
    await screen.findByText('search.incomplete');
    fireEvent.click(screen.getByRole('button', { name: 'search.previous' }));
    expect(state.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ page: 1, provider: '1' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: 'search.next' }));
    expect(state.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ page: 3, provider: '1' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: 'search.retry' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
  it('changes and removes business filters and resets paging', () => {
    const onChange = vi.fn();
    const query = {
      ...state.search,
      types: ['news.article'],
      categories: ['Culture'],
      provider: '1',
      page: 3,
    };
    render(
      <SearchFilters query={query} options={data.options} loading={false} onChange={onChange} />
    );
    fireEvent.change(screen.getByLabelText('search.provider'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ provider: '', page: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'search.remove Provider' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ provider: '' }));
    fireEvent.click(screen.getByLabelText('search.category'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Culture' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categories: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'search.reset' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...query,
      types: [],
      categories: [],
      provider: '',
      page: 1,
    });
  });
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
    let resolveOld: ((value: Response) => void) | undefined;
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
    if (!resolveOld) throw new Error('missing pending request');
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
