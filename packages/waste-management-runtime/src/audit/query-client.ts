export type QueryClient = {
  query<T>(sql: string, params?: readonly unknown[]): Promise<{
    rowCount: number;
    rows: T[];
  }>;
};
