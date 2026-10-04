export type TestSyncState = {
  sync_scope_key?: string;
  last_started_at: string | null;
  last_succeeded_at: string | null;
  last_failed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  projected_count: number;
  refresh_run_id?: string | null;
  refresh_phase?: 'hot' | 'reconciliation' | null;
  snapshot_state?: string;
  completed_page?: number;
  available_count?: number;
  is_total_final?: boolean;
  generation?: number;
  completed_generation?: number;
  snapshot_invalidated?: boolean;
};

type SyncStateFixture = {
  syncStates: Map<string, TestSyncState>;
  simulateLegacySyncStateSchemaMismatchOnce: boolean;
  syncScopeKeyColumnAvailable: boolean;
};

type QueryResult = { rows: unknown[]; rowCount: number };
type QueryValue = (
  values: readonly unknown[] | undefined,
  index: number,
  fallback?: unknown
) => unknown;

type SyncStateQueryContext = Readonly<{
  fixture: SyncStateFixture;
  queryValue: QueryValue;
}>;

const storedSyncState = (
  fixture: SyncStateFixture,
  contentType: string,
  syncScopeKey: string
): TestSyncState | undefined =>
  fixture.syncStates.get(`${contentType}::${syncScopeKey}`) ?? fixture.syncStates.get(contentType);

const setSyncState = (
  fixture: SyncStateFixture,
  contentType: string,
  syncScopeKey: string,
  value: TestSyncState
): void => {
  fixture.syncStates.set(`${contentType}::${syncScopeKey}`, value);
  fixture.syncStates.set(contentType, value);
};

const initialSyncState = (syncScopeKey: string): TestSyncState => ({
  sync_scope_key: syncScopeKey,
  last_started_at: null,
  last_succeeded_at: null,
  last_failed_at: null,
  last_error_code: null,
  last_error_message: null,
  projected_count: 0,
  generation: 0,
  completed_generation: 0,
  snapshot_invalidated: false,
});

const partialRunningSyncState = (
  context: SyncStateQueryContext,
  current: TestSyncState,
  values: readonly unknown[] | undefined,
  firstPayloadIndex: number
): TestSyncState => ({
  ...current,
  last_started_at: new Date().toISOString(),
  generation: context.fixture.syncScopeKeyColumnAvailable
    ? Number(context.queryValue(values, firstPayloadIndex + 2))
    : (current.generation ?? 0) + 1,
  refresh_run_id: String(context.queryValue(values, firstPayloadIndex)),
  refresh_phase: String(context.queryValue(values, firstPayloadIndex + 1, 'hot')) as
    'hot' | 'reconciliation',
  snapshot_state: 'partial_running',
  completed_page: 0,
  is_total_final: false,
});

const failedInsertedSyncState = (
  context: SyncStateQueryContext,
  current: TestSyncState,
  values: readonly unknown[] | undefined,
  firstPayloadIndex: number
): TestSyncState => ({
  ...current,
  last_failed_at: new Date().toISOString(),
  last_error_code: String(context.queryValue(values, firstPayloadIndex)),
  last_error_message: String(context.queryValue(values, firstPayloadIndex + 1)),
});

const succeededSyncState = (
  context: SyncStateQueryContext,
  current: TestSyncState,
  values: readonly unknown[] | undefined,
  firstPayloadIndex: number
): TestSyncState => {
  const projectedCount = Number(context.queryValue(values, firstPayloadIndex, 0));
  const preserveRefreshStart = context.queryValue(values, firstPayloadIndex + 1) === true;
  return {
    ...current,
    last_started_at: preserveRefreshStart ? current.last_started_at : new Date().toISOString(),
    last_succeeded_at: new Date().toISOString(),
    completed_generation: current.generation ?? 0,
    last_failed_at: null,
    last_error_code: null,
    last_error_message: null,
    projected_count: projectedCount,
    snapshot_state: 'complete_fresh',
    available_count: projectedCount,
    is_total_final: true,
    refresh_run_id: null,
    refresh_phase: null,
    snapshot_invalidated: preserveRefreshStart ? false : current.snapshot_invalidated,
  };
};

const buildInsertedSyncState = (
  context: SyncStateQueryContext,
  text: string,
  values: readonly unknown[] | undefined,
  contentType: string,
  syncScopeKey: string
): TestSyncState => {
  const current =
    (context.fixture.syncScopeKeyColumnAvailable
      ? context.fixture.syncStates.get(`${contentType}::${syncScopeKey}`)
      : storedSyncState(context.fixture, contentType, syncScopeKey)) ??
    initialSyncState(syncScopeKey);
  const firstPayloadIndex = context.fixture.syncScopeKeyColumnAvailable ? 3 : 2;
  if (text.includes("'partial_running'")) {
    return partialRunningSyncState(context, current, values, firstPayloadIndex);
  }
  if (text.includes('last_failed_at') && !text.includes('last_succeeded_at')) {
    return failedInsertedSyncState(context, current, values, firstPayloadIndex);
  }
  if (text.includes('last_succeeded_at')) {
    return succeededSyncState(context, current, values, firstPayloadIndex);
  }
  return { ...current, last_started_at: new Date().toISOString() };
};

const readSyncState = (
  context: SyncStateQueryContext,
  text: string,
  values: readonly unknown[] | undefined
): QueryResult | null => {
  if (
    !text.trimStart().startsWith('SELECT') ||
    !text.includes('FROM iam.content_list_projection_sync_state')
  ) {
    return null;
  }
  const contentType = String(context.queryValue(values, 1));
  if (text.includes('AS superseded')) {
    const generation = Number(context.queryValue(values, 2));
    const affectedScopeKeys = context.queryValue(values, 3);
    const superseded = [...context.fixture.syncStates.entries()].some(
      ([key, state]) =>
        key.startsWith(`${contentType}::`) &&
        (!Array.isArray(affectedScopeKeys) || affectedScopeKeys.includes(state.sync_scope_key)) &&
        Boolean((state.completed_generation ?? 0) > generation)
    );
    return { rows: [{ superseded }], rowCount: 1 };
  }
  const syncScopeKey = String(context.queryValue(values, 2));
  const row = storedSyncState(context.fixture, contentType, syncScopeKey);
  const selectedRow =
    row && !context.fixture.syncScopeKeyColumnAvailable
      ? { ...row, sync_scope_key: undefined }
      : row;
  return { rows: selectedRow ? [selectedRow] : [], rowCount: selectedRow ? 1 : 0 };
};

const insertSyncState = (
  context: SyncStateQueryContext,
  text: string,
  values: readonly unknown[] | undefined
): QueryResult | null => {
  if (!text.includes('INSERT INTO iam.content_list_projection_sync_state')) {
    return null;
  }
  const { fixture, queryValue } = context;
  if (text.includes('RETURNING generation::text')) {
    const contentType = String(queryValue(values, 1));
    const scopeKey = String(queryValue(values, 2));
    const current = fixture.syncStates.get(`${contentType}::${scopeKey}`);
    const generation = (current?.generation ?? 0) + 1;
    setSyncState(fixture, contentType, scopeKey, {
      ...(current ?? initialSyncState(scopeKey)),
      generation,
    });
    return { rows: [{ generation: String(generation) }], rowCount: 1 };
  }
  if (
    fixture.simulateLegacySyncStateSchemaMismatchOnce &&
    !text.includes('sync_scope_key') &&
    fixture.syncScopeKeyColumnAvailable
  ) {
    fixture.simulateLegacySyncStateSchemaMismatchOnce = false;
    const error = new Error(
      'duplicate key value violates unique constraint "content_list_projection_sync_state_pkey"'
    ) as Error & { code?: string; constraint?: string };
    error.code = '23505';
    error.constraint = 'content_list_projection_sync_state_pkey';
    throw error;
  }
  const contentType = String(queryValue(values, 1));
  const syncScopeKey =
    typeof queryValue(values, 2) === 'string' && fixture.syncScopeKeyColumnAvailable
      ? String(queryValue(values, 2))
      : contentType;
  const next = buildInsertedSyncState(context, text, values, contentType, syncScopeKey);
  setSyncState(
    fixture,
    contentType,
    syncScopeKey,
    text.includes('completed_generation = $4::bigint')
      ? { ...next, completed_generation: Number(queryValue(values, 3)) }
      : next
  );
  return { rows: [], rowCount: 1 };
};

const buildUpdatedSyncState = (
  context: SyncStateQueryContext,
  text: string,
  values: readonly unknown[] | undefined,
  current: TestSyncState
): TestSyncState => {
  const firstPayloadIndex = context.fixture.syncScopeKeyColumnAvailable ? 4 : 3;
  if (text.includes('last_failed_at = NOW()')) {
    return {
      ...current,
      last_failed_at: new Date().toISOString(),
      last_error_code: String(context.queryValue(values, firstPayloadIndex)),
      last_error_message: String(context.queryValue(values, firstPayloadIndex + 1)),
      snapshot_state: current.last_succeeded_at ? 'complete_failed' : 'partial_failed',
      is_total_final: false,
    };
  }
  if (text.includes('refresh_phase = $5') || text.includes('refresh_phase = $4')) {
    return {
      ...current,
      refresh_phase: String(context.queryValue(values, firstPayloadIndex)) as 'reconciliation',
    };
  }
  return {
    ...current,
    completed_page: Number(context.queryValue(values, firstPayloadIndex, 0)),
    available_count: Number(context.queryValue(values, firstPayloadIndex + 1, 0)),
    is_total_final: false,
  };
};

const updateSyncState = (
  context: SyncStateQueryContext,
  text: string,
  values: readonly unknown[] | undefined
): QueryResult | null => {
  if (!text.includes('UPDATE iam.content_list_projection_sync_state')) {
    return null;
  }
  const { fixture, queryValue } = context;
  const contentType = String(queryValue(values, 1));
  if (text.includes('snapshot_invalidated = TRUE')) {
    const excludedScopeKey = String(queryValue(values, 2));
    let count = 0;
    for (const [key, state] of fixture.syncStates) {
      if (
        !key.startsWith(`${contentType}::`) ||
        key === `${contentType}::${excludedScopeKey}` ||
        state.sync_scope_key === '__mainserver_global_mutation__'
      )
        continue;
      fixture.syncStates.set(key, { ...state, snapshot_invalidated: true });
      count += 1;
    }
    return { rows: [], rowCount: count };
  }
  const syncScopeKey = fixture.syncScopeKeyColumnAvailable
    ? String(queryValue(values, 2, contentType))
    : contentType;
  const current = storedSyncState(fixture, contentType, syncScopeKey);
  const refreshRunId = String(queryValue(values, fixture.syncScopeKeyColumnAvailable ? 3 : 2));
  if (current?.refresh_run_id !== refreshRunId) {
    return { rows: [], rowCount: 0 };
  }
  setSyncState(
    fixture,
    contentType,
    syncScopeKey,
    buildUpdatedSyncState(context, text, values, current)
  );
  return { rows: [], rowCount: 1 };
};

export const createSyncStateQueryHandlers = (fixture: SyncStateFixture, queryValue: QueryValue) => {
  const context = { fixture, queryValue };
  return {
    read: (text: string, values: readonly unknown[] | undefined) =>
      readSyncState(context, text, values),
    insert: (text: string, values: readonly unknown[] | undefined) =>
      insertSyncState(context, text, values),
    update: (text: string, values: readonly unknown[] | undefined) =>
      updateSyncState(context, text, values),
  };
};
