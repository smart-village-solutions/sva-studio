export const iamGovernanceVersion = '0.0.1';

export type IamGovernancePackageRole = 'dsr' | 'legal-texts' | 'audit' | 'governance-cases';

export const iamGovernancePackageRoles = [
  'dsr',
  'legal-texts',
  'audit',
  'governance-cases',
] as const satisfies readonly IamGovernancePackageRole[];

export { listGovernanceCases } from './read-models.js';
export type { GovernanceFilters } from './read-models.types.js';
export {
  listAdminDsrCases,
  loadDsrSelfServiceOverview,
  toCanonicalDsrStatus,
} from './dsr-read-models.js';
export type { DsrFilters } from './dsr-read-models.types.js';
export { hashLegalTextHtml, sanitizeLegalTextHtml } from './legal-text-html.js';
