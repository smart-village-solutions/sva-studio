export const dataClientVersion = '0.0.1';

export type DataClientPackageRole = 'http-client' | 'schema-validation' | 'browser-cache';

export const dataClientPackageRoles = [
  'http-client',
  'schema-validation',
  'browser-cache',
] as const satisfies readonly DataClientPackageRole[];
