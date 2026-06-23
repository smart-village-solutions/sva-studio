export const createJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const createTestDepsBuilder =
  <TDeps extends object>(buildDefaults: () => TDeps) =>
  (overrides: Partial<TDeps> = {}): TDeps => ({
    ...buildDefaults(),
    ...overrides,
  });

export const dbWriteFailedErrorBody = (code: 'conflict' | 'internal_error', requestId: string) => ({
  error: {
    code,
    details: {
      syncState: 'failed',
      syncError: { code: 'DB_WRITE_FAILED' },
    },
  },
  requestId,
});
