export const iamCoreVersion = '0.0.1';

export type IamCorePackageRole = 'authorization-contracts' | 'permission-engine' | 'pii-invariants';

export const iamCorePackageRoles = [
  'authorization-contracts',
  'permission-engine',
  'pii-invariants',
] as const satisfies readonly IamCorePackageRole[];
