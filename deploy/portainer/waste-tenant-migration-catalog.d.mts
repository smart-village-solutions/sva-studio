export type WasteTenantMigration = Readonly<{
  id: string;
  statements: readonly string[];
  verification: Readonly<{
    sql: string;
    values: readonly unknown[];
  }>;
}>;

export const wasteTenantMigrations: readonly WasteTenantMigration[];
