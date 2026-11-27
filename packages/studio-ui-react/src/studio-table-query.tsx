import {
  hashKey,
  QueryClient,
  QueryClientProvider,
  useQuery,
  type QueryKey,
} from '@tanstack/react-query';
import { STUDIO_TABLE_DATA_CHANGED } from '@sva/plugin-sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type TableQueryContext = Readonly<{ client: QueryClient; scope: number | null }>;
type ReadResult<T> = Readonly<{ data: T }> | Readonly<{ denied: unknown }>;

const TableQueryContext = createContext<TableQueryContext | null>(null);
const createTableQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

async function invalidateTableQueries(
  client: QueryClient,
  queryKey: QueryKey,
  refetchActive = true,
  deleted = false
) {
  client.removeQueries({ queryKey, type: 'inactive' });
  if (deleted) {
    await client.resetQueries({ queryKey, type: 'active' });
    return;
  }
  await client.cancelQueries({ queryKey });
  await client.invalidateQueries({ queryKey, refetchType: refetchActive ? 'active' : 'none' });
}

export function StudioTableQueryProvider({
  scope,
  children,
}: Readonly<{ scope: number | null; children: ReactNode }>) {
  const [client] = useState(createTableQueryClient);
  useEffect(() => {
    if (scope === null) return;
    const onTableDataChanged = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail?.resource !== 'string') return;
      const { resource, deleted } = event.detail;
      const affected =
        resource === 'media' ? [resource] : [resource, 'contents', 'content-history'];
      for (const key of new Set<string>(affected)) {
        void invalidateTableQueries(client, [scope, key], true, deleted === true);
      }
    };
    globalThis.addEventListener(STUDIO_TABLE_DATA_CHANGED, onTableDataChanged);
    return () => {
      globalThis.removeEventListener(STUDIO_TABLE_DATA_CHANGED, onTableDataChanged);
      client.removeQueries({ queryKey: [scope] });
    };
  }, [client, scope]);

  return (
    <QueryClientProvider client={client}>
      <TableQueryContext.Provider value={{ client, scope }}>{children}</TableQueryContext.Provider>
    </QueryClientProvider>
  );
}

function isAccessDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { httpStatus, status, statusCode } = error as {
    httpStatus?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return (
    [httpStatus, status, statusCode].some((value) => value === 401 || value === 403) ||
    (error instanceof Error && /^(?:http_(?:401|403)|unauthorized|forbidden)$/.test(error.message))
  );
}

export function useStudioTableQuery<T>(
  key: QueryKey,
  read: (signal: AbortSignal, previous: T | undefined) => Promise<T>,
  enabled = true
) {
  const context = useContext(TableQueryContext);
  const [standaloneClient] = useState(() => (context ? undefined : createTableQueryClient()));
  const available = enabled && context?.scope !== null;
  const client = context?.client ?? standaloneClient;
  const queryKey = [context?.scope ?? null, ...key];
  const queryHash = hashKey(queryKey);
  const activeHash = useRef<string | null>(null);
  useLayoutEffect(() => {
    activeHash.current = available ? queryHash : null;
    return () => {
      activeHash.current = null;
    };
  }, [available, queryHash]);
  const query = useQuery<ReadResult<T>>(
    {
      queryKey,
      enabled: available,
      queryFn: async ({ signal, client, queryKey }) => {
        try {
          const previous = client.getQueryData<ReadResult<T>>(queryKey);
          return {
            data: await read(signal, previous && 'data' in previous ? previous.data : undefined),
          };
        } catch (error) {
          if (!isAccessDenied(error)) throw error;
          return { denied: error };
        }
      },
    },
    client
  );
  const result = available ? query.data : undefined;
  const data = result && 'data' in result ? result.data : undefined;
  const error = available ? (result && 'denied' in result ? result.denied : query.error) : null;
  const refresh = useCallback(
    async (replacePending = false) => {
      if (!client || activeHash.current !== queryHash) return undefined;
      const exactQuery = client.getQueryCache().get<ReadResult<T>>(queryHash);
      if (!exactQuery) return undefined;
      if (replacePending) {
        await client.cancelQueries({ queryKey: exactQuery.queryKey, exact: true });
      }
      if (activeHash.current !== queryHash || client.getQueryCache().get(queryHash) !== exactQuery)
        return undefined;
      try {
        const result = await exactQuery.fetch(undefined, { cancelRefetch: true });
        return activeHash.current === queryHash && 'data' in result ? result.data : undefined;
      } catch {
        return undefined;
      }
    },
    [client, queryHash]
  );
  const refetch = useCallback(async () => (await refresh()) !== undefined, [refresh]);
  const replaceData = async (data: T) => {
    if (activeHash.current !== queryHash || !client) return;
    await client.cancelQueries({ queryKey, exact: true });
    if (activeHash.current === queryHash && client.getQueryState(queryKey)) {
      const result: ReadResult<T> = { data };
      client.setQueryData<ReadResult<T>>(queryKey, () => result);
    }
  };
  return {
    data,
    dataUpdatedAt: available ? query.dataUpdatedAt : 0,
    error,
    isAvailable: available,
    state:
      data !== undefined ? ('ready' as const) : error ? ('error' as const) : ('loading' as const),
    isFetching: available && query.isFetching,
    refresh,
    refetch,
    replaceData,
  };
}

export function useStudioTableInvalidation() {
  const context = useContext(TableQueryContext);
  const client = context?.client;
  const scope = context?.scope;
  return useCallback(
    (key: QueryKey, refetchActive = true) => {
      if (!client || scope == null) return Promise.resolve();
      return invalidateTableQueries(client, [scope, ...key], refetchActive);
    },
    [client, scope]
  );
}
