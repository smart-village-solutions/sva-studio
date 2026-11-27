import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { notifyStudioTableDataChanged } from '@sva/plugin-sdk/studio-table-events';
import { afterEach, expect, it, vi } from 'vitest';
import {
  StudioTableQueryProvider,
  useStudioTableInvalidation,
  useStudioTableQuery,
} from './studio-table-query.js';

afterEach(cleanup);

it('reuses the exact table result on remount and drops it when access changes or is denied', async () => {
  let resolveDeferred: ((rows: string) => void) | undefined;
  const deferred = new Promise<string>((resolve) => {
    resolveDeferred = resolve;
  });
  const read = vi
    .fn<() => Promise<string>>()
    .mockResolvedValueOnce('previous rows')
    .mockReturnValueOnce(deferred)
    .mockResolvedValueOnce('new scope rows')
    .mockRejectedValueOnce(Object.assign(new Error('forbidden'), { httpStatus: 403 }));

  function Table() {
    const { data, state } = useStudioTableQuery(['table', 1], read);
    return <p>{data ?? state}</p>;
  }

  const renderRoute = (scope: number | null, visible: boolean) => (
    <StudioTableQueryProvider scope={scope}>{visible ? <Table /> : null}</StudioTableQueryProvider>
  );
  const view = render(renderRoute(1, true));
  expect(await screen.findByText('previous rows')).toBeTruthy();

  view.rerender(renderRoute(1, false));
  view.rerender(renderRoute(1, true));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(screen.getByText('previous rows')).toBeTruthy();
  expect(screen.queryByText('loading')).toBeNull();

  view.rerender(renderRoute(null, true));
  expect(screen.queryByText('previous rows')).toBeNull();
  await act(async () => resolveDeferred?.('late old rows'));
  view.rerender(renderRoute(2, true));
  expect(await screen.findByText('new scope rows')).toBeTruthy();
  expect(screen.queryByText('late old rows')).toBeNull();

  view.rerender(renderRoute(2, false));
  view.rerender(renderRoute(2, true));
  expect(await screen.findByText('error')).toBeTruthy();
  expect(screen.queryByText('new scope rows')).toBeNull();
});

it.each(['cold', 'warm failure', 'warm interruption'] as const)(
  'discards pre-deletion rows for a %s refresh',
  async (start) => {
    let finishOld!: (value: string) => void;
    const old = new Promise<string>((resolve) => {
      finishOld = resolve;
    });
    const read = vi.fn<() => Promise<string>>();
    if (start !== 'cold') read.mockResolvedValueOnce('deleted row');
    else read.mockReturnValueOnce(old);
    if (start === 'warm interruption') read.mockReturnValueOnce(old);
    else read.mockRejectedValueOnce(new Error('unavailable'));
    read.mockResolvedValue('remaining rows');

    function Table() {
      const { data, error } = useStudioTableQuery(['projects', 1], read);
      return <p>{data ?? (error ? 'refresh failed' : 'loading')}</p>;
    }
    const route = (show: boolean) => (
      <StudioTableQueryProvider scope={1}>{show ? <Table /> : null}</StudioTableQueryProvider>
    );
    const view = render(route(true));
    if (start !== 'cold') await screen.findByText('deleted row');
    else await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    act(() => notifyStudioTableDataChanged('projects', true));
    if (start === 'warm interruption') {
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    } else {
      await screen.findByText('refresh failed');
    }
    view.rerender(route(false));
    await act(async () => finishOld('deleted row'));
    view.rerender(route(true));
    expect(screen.queryByText('deleted row')).toBeNull();
    expect(await screen.findByText('remaining rows')).toBeTruthy();
  }
);

it('restarts a cold read after an update and ignores the old result', async () => {
  let finishOld!: (value: string) => void;
  const old = new Promise<string>((resolve) => {
    finishOld = resolve;
  });
  const read = vi.fn<() => Promise<string>>().mockReturnValueOnce(old).mockResolvedValue('updated');
  function Table() {
    return <p>{useStudioTableQuery(['projects'], read).data}</p>;
  }
  render(
    <StudioTableQueryProvider scope={1}>
      <Table />
    </StudioTableQueryProvider>
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  act(() => notifyStudioTableDataChanged('projects'));
  expect(await screen.findByText('updated')).toBeTruthy();
  await act(async () => finishOld('obsolete'));
  expect(screen.queryByText('obsolete')).toBeNull();
});

it('ignores an older refresh callback once a different query is selected or access is suspended', async () => {
  const read = vi.fn(async () => 'rows');
  const { result, rerender } = renderHook(
    ({ filter, enabled }) => useStudioTableQuery(['table', filter], read, enabled),
    { initialProps: { filter: 'first', enabled: true } }
  );
  await waitFor(() => expect(result.current.data).toBe('rows'));
  const refreshFirst = result.current.refresh;
  rerender({ filter: 'second', enabled: true });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  const refreshSecond = result.current.refresh;
  expect(await refreshFirst(true)).toBeUndefined();
  rerender({ filter: 'second', enabled: false });
  expect(await refreshSecond(true)).toBeUndefined();
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.current.data).toBeUndefined();
});

it('discards inactive table data after a mutation before the user returns', async () => {
  let finish: ((value: string) => void) | undefined;
  const read = vi.fn<() => Promise<string>>().mockResolvedValueOnce('previous rows');
  read.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  function Table() {
    const { data, state } = useStudioTableQuery(['projects', 1], read);
    return <p>{data ?? state}</p>;
  }
  const view = render(
    <StudioTableQueryProvider scope={1}>
      <Table />
    </StudioTableQueryProvider>
  );
  expect(await screen.findByText('previous rows')).toBeTruthy();
  view.rerender(<StudioTableQueryProvider scope={1}>{null}</StudioTableQueryProvider>);
  act(() => notifyStudioTableDataChanged('projects'));
  view.rerender(
    <StudioTableQueryProvider scope={1}>
      <Table />
    </StudioTableQueryProvider>
  );
  expect(screen.queryByText('previous rows')).toBeNull();
  await act(async () => finish?.('current rows'));
  expect(await screen.findByText('current rows')).toBeTruthy();
});

it('shares an in-flight request, retains an empty result on failure, and isolates new filters', async () => {
  let resolveInitial: ((rows: readonly string[]) => void) | undefined;
  const initial = new Promise<readonly string[]>((resolve) => {
    resolveInitial = resolve;
  });
  const read = vi
    .fn<() => Promise<readonly string[]>>()
    .mockReturnValueOnce(initial)
    .mockRejectedValueOnce(new Error('temporarily unavailable'))
    .mockResolvedValueOnce(['filtered row']);

  function Table({ filter }: Readonly<{ filter: string }>) {
    const { data, state, error } = useStudioTableQuery(['table', filter], read);
    return (
      <p>
        {data ? (data.length ? data.join(', ') : 'no rows') : state}
        {error ? ' with error' : ''}
      </p>
    );
  }
  const route = (children: React.ReactNode) => (
    <StudioTableQueryProvider scope={1}>{children}</StudioTableQueryProvider>
  );
  const view = render(
    route(
      <>
        <Table filter="" />
        <Table filter="" />
      </>
    )
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  await act(async () => resolveInitial?.([]));
  expect(await screen.findAllByText('no rows')).toHaveLength(2);

  view.rerender(route(null));
  view.rerender(route(<Table filter="" />));
  expect(screen.getByText('no rows')).toBeTruthy();
  expect(await screen.findByText('no rows with error')).toBeTruthy();

  view.rerender(route(<Table filter="filtered" />));
  expect(screen.queryByText(/no rows/)).toBeNull();
  expect(await screen.findByText('filtered row')).toBeTruthy();
});

it('keeps a mutation result when its background read resolves late and ignores obsolete write callbacks', async () => {
  let complete!: (rows: string) => void;
  const previous = new Promise<string>((resolve) => {
    complete = resolve;
  });
  const read = vi
    .fn<(signal: AbortSignal) => Promise<string>>()
    .mockReturnValueOnce(previous)
    .mockResolvedValue('another filter');
  const { result, rerender } = renderHook(
    ({ filter }) => useStudioTableQuery(['table', filter], read),
    { initialProps: { filter: 'first' } }
  );
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  const writeFirstFilter = result.current.replaceData;
  await act(async () => writeFirstFilter('saved rows'));

  expect(read.mock.calls[0]?.[0].aborted).toBe(true);
  await waitFor(() => expect(result.current.data).toBe('saved rows'));
  await act(async () => complete('late rows'));
  expect(result.current.data).toBe('saved rows');

  rerender({ filter: 'second' });
  await waitFor(() => expect(result.current.data).toBe('another filter'));
  await act(async () => writeFirstFilter('wrong filter'));
  expect(result.current.data).toBe('another filter');
});

it('replaces a pending read on explicit refresh and clears the result on access denial', async () => {
  const read = vi
    .fn<(signal: AbortSignal) => Promise<string>>()
    .mockImplementationOnce(() => new Promise(() => undefined))
    .mockResolvedValueOnce('current rows')
    .mockRejectedValueOnce('temporary failure')
    .mockRejectedValueOnce(new Error('unauthorized'));
  const { result } = renderHook(() => useStudioTableQuery(['table'], read));
  await waitFor(() => expect(read).toHaveBeenCalledOnce());

  await act(async () => {
    expect(await result.current.refresh(true)).toBe('current rows');
  });
  expect(read.mock.calls[0]?.[0].aborted).toBe(true);
  await waitFor(() => expect(result.current.data).toBe('current rows'));

  await act(async () => {
    expect(await result.current.refetch()).toBe(false);
  });
  await waitFor(() => expect(result.current.error).toBe('temporary failure'));
  expect(result.current.data).toBe('current rows');

  await act(async () => {
    expect(await result.current.refetch()).toBe(false);
  });
  await waitFor(() => expect(result.current.state).toBe('error'));
  expect(result.current.data).toBeUndefined();
});

it('can invalidate a resource without starting an active read until explicitly refreshed', async () => {
  const read = vi
    .fn<() => Promise<string>>()
    .mockResolvedValueOnce('before mutation')
    .mockResolvedValueOnce('after mutation');
  const { result } = renderHook(
    () => ({
      list: useStudioTableQuery(['media', 1], read),
      invalidate: useStudioTableInvalidation(),
    }),
    {
      wrapper: ({ children }) => (
        <StudioTableQueryProvider scope={1}>{children}</StudioTableQueryProvider>
      ),
    }
  );
  await waitFor(() => expect(result.current.list.data).toBe('before mutation'));
  await act(async () => result.current.invalidate(['media'], false));
  expect(read).toHaveBeenCalledOnce();
  expect(result.current.list.data).toBe('before mutation');

  await act(async () => {
    expect(await result.current.list.refetch()).toBe(true);
  });
  await waitFor(() => expect(result.current.list.data).toBe('after mutation'));
});
