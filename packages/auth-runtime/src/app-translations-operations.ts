import {
  APP_TRANSLATION_MAX_LOCALES,
  isAppTranslationLocale,
  AppTranslationError,
  type DeepLSetupStatus,
  type AppTranslationLocale,
} from '@sva/core';
import type { AppTranslationRepository } from '@sva/data-repositories/server';
import { z } from 'zod';
import { catalogTranslationRequest } from './app-translations-jobs.js';

const contractId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const expectedRevision = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const localeSchema = z.string().refine(isAppTranslationLocale);
const locales = z.array(localeSchema).min(1).max(APP_TRANSLATION_MAX_LOCALES);
const textFields = {
  contractId,
  expectedRevision,
  locale: localeSchema,
  key: z.string().min(1).max(128),
};
export const operationSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('overview') }).strict(),
  catalogTranslationRequest,
  z.object({ operation: z.literal('translationStatus'), contractId }).strict(),
  z.object({ operation: z.literal('configureLocales'), contractId, expectedRevision }).strict(),
  z.object({ operation: z.literal('read'), contractId }).strict(),
  z.object({ operation: z.literal('readRelease'), releaseId: z.uuid() }).strict(),
  z
    .object({
      operation: z.literal('downloadTexts'),
      releaseId: z.uuid(),
      mode: z.enum(['source', 'translations']).optional(),
    })
    .strict(),
  z
    .object({ operation: z.literal('import'), manifest: z.unknown(), expectedRevision, locales })
    .strict(),
  z.object({ operation: z.literal('createMunicipal'), baseReleaseId: z.uuid(), locales }).strict(),
  z
    .object({
      operation: z.literal('changeBase'),
      contractId,
      expectedRevision,
      baseReleaseId: z.uuid(),
      locales,
    })
    .strict(),
  z
    .object({
      operation: z.literal('edit'),
      ...textFields,
      value: z.union([z.string().max(32768), z.array(z.string().max(32768)).min(1).max(100)]),
    })
    .strict(),
  z.object({ operation: z.literal('reset'), ...textFields }).strict(),
  z.object({ operation: z.literal('confirm'), ...textFields }).strict(),
  z.object({ operation: z.literal('seal'), contractId, expectedRevision }).strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
export const actionFor = (op: Operation): string =>
  op.operation === 'import'
    ? 'app-translations.manifestImport'
    : ['overview', 'read', 'readRelease', 'downloadTexts', 'translationStatus'].includes(
          op.operation
        )
      ? 'app-translations.catalog.read'
      : op.operation === 'seal'
        ? 'app-translations.catalog.publish'
        : 'app-translations.catalog.write';
export const dispatch = (
  repo: AppTranslationRepository,
  op: Operation,
  sourceOnly = false,
  allowedLocales: readonly AppTranslationLocale[] = ['de'],
  targetCodes: Readonly<Record<string, string>> = {}
) => {
  switch (op.operation) {
    case 'downloadTexts':
    case 'translate':
    case 'translationStatus':
      throw new AppTranslationError('catalog_forbidden');
    case 'configureLocales':
      return repo.configureLocales(op.contractId, op.expectedRevision, allowedLocales);
    case 'overview':
      return repo.overview();
    case 'read':
      return repo.readEffective(op.contractId);
    case 'readRelease':
      return repo.loadRelease(op.releaseId);
    case 'import':
      return repo.importManifest(op.manifest, op.expectedRevision, op.locales);
    case 'createMunicipal':
      return repo.createMunicipalDraft(op.baseReleaseId, op.locales);
    case 'changeBase':
      return repo.changeBase(op.contractId, op.expectedRevision, op.baseReleaseId, op.locales);
    case 'edit':
      return repo.editText(
        op.contractId,
        op.expectedRevision,
        op.locale,
        op.key,
        op.value,
        targetCodes[op.locale]
      );
    case 'reset':
      return repo.resetOverride(op.contractId, op.expectedRevision, op.locale, op.key);
    case 'confirm':
      return repo.confirmCorrection(
        op.contractId,
        op.expectedRevision,
        op.locale,
        op.key,
        targetCodes[op.locale]
      );
    case 'seal':
      return repo.seal(op.contractId, op.expectedRevision, sourceOnly, targetCodes);
  }
};

type Result = Awaited<ReturnType<typeof dispatch>>;

export const projectGermanCatalog = (value: Result, op: Operation) => {
  const onlyGerman = (locales: readonly string[]) => locales.length === 1 && locales[0] === 'de';
  if ('draft' in value)
    return {
      ...value,
      draft: {
        ...value.draft,
        supportedLocales: ['de'],
        valuesByLocale: { de: value.draft.valuesByLocale.de ?? {} },
        machineStandardValuesByLocale: {},
      },
      values: { de: value.values.de ?? {} },
      baseCatalogs: { de: value.baseCatalogs.de },
    };
  if ('valuesByLocale' in value)
    return {
      ...value,
      supportedLocales: ['de'],
      valuesByLocale: { de: value.valuesByLocale.de ?? {} },
      machineStandardValuesByLocale: {},
    };
  if ('bases' in value)
    return {
      ...value,
      catalogs: value.catalogs.map((row) => ({ ...row, supportedLocales: ['de'] })),
      bases: value.bases.filter((row) => onlyGerman(row.supportedLocales)),
    };
  if (op.operation !== 'readRelease' && !onlyGerman(value.supportedLocales))
    throw new AppTranslationError('catalog_forbidden');

  return value;
};

export const projectTranslatedCatalog = (
  value: Result,
  op: Operation,
  allowedLocales: readonly AppTranslationLocale[],
  targetCodes: Readonly<Record<string, string>>,
  setup: DeepLSetupStatus | undefined,
  canManageInterfaces: boolean
) => {
  if (
    op.operation !== 'readRelease' &&
    'state' in value &&
    value.supportedLocales.some((locale) => !allowedLocales.includes(locale))
  )
    throw new AppTranslationError('catalog_forbidden');
  if ('valuesByLocale' in value)
    return {
      ...value,
      machineStandardValuesByLocale: Object.fromEntries(
        Object.entries(value.machineStandardValuesByLocale ?? {}).filter(([locale]) =>
          allowedLocales.includes(locale)
        )
      ),
      supportedLocales: value.supportedLocales.filter((locale) => allowedLocales.includes(locale)),
      valuesByLocale: Object.fromEntries(
        Object.entries(value.valuesByLocale).filter(([locale]) =>
          allowedLocales.includes(locale as AppTranslationLocale)
        )
      ),
    };
  if ('bases' in value)
    return {
      ...value,
      allowedLocales: [...allowedLocales],
      setup,
      canManageInterfaces,
    };
  if ('draft' in value) {
    const selected = value.draft.supportedLocales.filter((locale) =>
      allowedLocales.includes(locale)
    );
    return {
      ...value,
      allowedLocales,
      targetCodes,
      setup,
      canManageInterfaces,
      draft: {
        ...value.draft,
        supportedLocales: selected,
        machineStandardValuesByLocale: Object.fromEntries(
          Object.entries(value.draft.machineStandardValuesByLocale ?? {}).filter(([locale]) =>
            selected.includes(locale)
          )
        ),
        valuesByLocale: Object.fromEntries(
          Object.entries(value.draft.valuesByLocale).filter(([locale]) =>
            selected.includes(locale as (typeof selected)[number])
          )
        ),
      },
      values: Object.fromEntries(
        Object.entries(value.values).filter(([locale]) =>
          selected.includes(locale as (typeof selected)[number])
        )
      ),
      baseCatalogs: Object.fromEntries(
        Object.entries(value.baseCatalogs).filter(([locale]) =>
          selected.includes(locale as (typeof selected)[number])
        )
      ),
    };
  }
  return value;
};
