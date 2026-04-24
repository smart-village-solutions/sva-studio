export const dataRepositoriesVersion = '0.0.1';

export type DataRepositoriesPackageRole = 'postgres-repositories' | 'migration-adjacent-types' | 'server-data-access';

export const dataRepositoriesPackageRoles = [
  'postgres-repositories',
  'migration-adjacent-types',
  'server-data-access',
] as const satisfies readonly DataRepositoriesPackageRole[];
