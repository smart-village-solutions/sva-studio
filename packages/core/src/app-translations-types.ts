/** Fixed-catalog persistence and editor contracts. */
import type { AppTranslationLocale } from './app-translations-validation.js';
import type { DeepLSetupStatus } from './app-translations-deepl.js';
export type CatalogValue = string | readonly string[];
export type CatalogScope =
  { kind: 'global' } | { kind: 'municipal'; instanceId: string; organizationId: string };
export type CatalogManifest = {
  contractId: string;
  manifestVersion: string;
  appCompatibility: { minVersion: string; maxVersion?: string };
  keys: Record<
    string,
    {
      type: 'string' | 'stringArray';
      defaultValue: CatalogValue;
      placeholders: Record<string, 'string' | 'number'>;
      allowEmpty: boolean;
    }
  >;
};
export type CatalogText = {
  value: CatalogValue;
  origin: 'default' | 'manual' | 'machine';
  sourceKind?: 'standard' | 'municipal';
  targetCode?: string;
  sourceDigest: string;
  confirmedSourceDigest: string | null;
};
export type CatalogTexts = Partial<Record<AppTranslationLocale, Record<string, CatalogText>>>;
export type CatalogDraft = {
  id: string;
  scope: CatalogScope;
  manifestId: string;
  manifest: CatalogManifest;
  draftRevision: string;
  supportedLocales: AppTranslationLocale[];
  valuesByLocale: CatalogTexts;
  machineStandardValuesByLocale?: CatalogTexts;
  baseReleaseId: string | null;
};
export type CatalogArtifact = {
  schemaVersion: 1;
  instanceId: string | null;
  organizationId: string | null;
  contractId: string;
  catalogSetRevision: string;
  locale: AppTranslationLocale;
  appCompatibility: CatalogManifest['appCompatibility'];
  sourceRevision: string;
  values: Record<string, CatalogValue>;
  fallbackKeys: string[];
  checksum: string;
};
export type CatalogRelease = {
  id: string;
  scope: CatalogScope;
  manifestId: string;
  contractId: string;
  catalogSetRevision: string;
  draftRevision: string;
  baseReleaseId: string | null;
  supportedLocales: AppTranslationLocale[];
  catalogs: Partial<Record<AppTranslationLocale, CatalogArtifact>>;
  descriptor: Record<string, unknown>;
  checksum: string;
  state: 'sealed';
};

export type CatalogReleaseSummary = Pick<
  CatalogRelease,
  'id' | 'contractId' | 'catalogSetRevision' | 'draftRevision' | 'supportedLocales' | 'checksum'
>;
export type CatalogOverview = {
  scope: CatalogScope;
  allowedLocales?: AppTranslationLocale[];
  setup?: DeepLSetupStatus;
  canManageInterfaces?: boolean;
  catalogs: (Pick<CatalogDraft, 'draftRevision' | 'supportedLocales' | 'baseReleaseId'> & {
    contractId: string;
  })[];
  releases: CatalogReleaseSummary[];
  bases: CatalogReleaseSummary[];
};
export type CatalogEditorData = {
  draft: CatalogDraft;
  values: CatalogTexts;
  baseCatalogs: CatalogRelease['catalogs'];
  allowedLocales?: AppTranslationLocale[];
  setup?: DeepLSetupStatus;
  canManageInterfaces?: boolean;
  targetCodes?: Record<string, string>;
};
