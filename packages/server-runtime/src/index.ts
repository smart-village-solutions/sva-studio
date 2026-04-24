export const serverRuntimeVersion = '0.0.1';

export type ServerRuntimePackageRole = 'request-context' | 'json-errors' | 'logging' | 'observability';

export const serverRuntimePackageRoles = [
  'request-context',
  'json-errors',
  'logging',
  'observability',
] as const satisfies readonly ServerRuntimePackageRole[];
