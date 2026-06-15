const iamCoreVersion = '0.0.1';

const iamCorePackageRoles = [
  'authorization-contracts',
  'permission-engine',
  'pii-invariants',
] as const;

type IamCorePackageRole = (typeof iamCorePackageRoles)[number];

export { iamCorePackageRoles, iamCoreVersion };
export type { IamCorePackageRole };
