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
export {
  consumeLegalConsentExportRateLimit,
  hasLegalConsentExportPermission,
  loadConsentExportRecords,
} from './legal-consent-export.js';
export { createLegalTextSchema, updateLegalTextSchema } from './legal-text-schemas.js';
export {
  createLegalTextRepository,
  LegalTextDeleteConflictError,
  type DeleteLegalTextInput,
  type LegalTextActivityLogInput,
  type LegalTextRepositoryDeps,
} from './legal-text-repository.js';
export {
  createLegalTextMutationHandlers,
  type LegalTextMutationHandlerDeps,
} from './legal-text-mutation-handlers.js';
export {
  createLegalTextHttpHandlers,
  type LegalTextHttpActor,
  type LegalTextHttpHandlerDeps,
  type LegalTextPendingUser,
} from './legal-text-http-handlers.js';
