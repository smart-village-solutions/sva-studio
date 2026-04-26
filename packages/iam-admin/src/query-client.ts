export type QueryResult<TRow> = {
  rowCount: number;
  rows: TRow[];
};

export type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
};
