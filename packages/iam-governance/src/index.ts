export const iamGovernanceVersion = '0.0.1';

export type IamGovernancePackageRole = 'dsr' | 'legal-texts' | 'audit' | 'governance-cases';

export const iamGovernancePackageRoles = [
  'dsr',
  'legal-texts',
  'audit',
  'governance-cases',
] as const satisfies readonly IamGovernancePackageRole[];
