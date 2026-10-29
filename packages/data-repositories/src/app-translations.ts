/** Transaction-bound catalog facade preserving the existing repository API. */
import type { CatalogScope } from '@sva/core';
import {
  createCatalogRepositoryContext,
  type CatalogSqlClient,
} from './app-translations-context.js';
export type { CatalogSqlClient } from './app-translations-context.js';
import * as read from './app-translations-read.js';
import * as imports from './app-translations-import.js';
import * as edit from './app-translations-edit.js';
/** All three scope settings replace prior values inside the existing transaction. */
export const createAppTranslationRepository = async (
  client: CatalogSqlClient,
  scope: CatalogScope
) => {
  const context = await createCatalogRepositoryContext(client, scope);
  return {
    loadDraft: context.loadDraft,
    loadRelease: (id: string) => context.loadRelease(id),
    overview: (
      ...args: Parameters<typeof read.overview> extends [unknown, ...infer Rest] ? Rest : never
    ) => read.overview(context, ...args),
    exportTexts: (
      ...args: Parameters<typeof read.exportTexts> extends [unknown, ...infer Rest] ? Rest : never
    ) => read.exportTexts(context, ...args),
    readEffective: (
      ...args: Parameters<typeof read.readEffective> extends [unknown, ...infer Rest] ? Rest : never
    ) => read.readEffective(context, ...args),
    importManifest: (
      ...args: Parameters<typeof imports.importManifest> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => imports.importManifest(context, ...args),
    createMunicipalDraft: (
      ...args: Parameters<typeof imports.createMunicipalDraft> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => imports.createMunicipalDraft(context, ...args),
    changeBase: (
      ...args: Parameters<typeof imports.changeBase> extends [unknown, ...infer Rest] ? Rest : never
    ) => imports.changeBase(context, ...args),
    configureLocales: (
      ...args: Parameters<typeof edit.configureLocales> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => edit.configureLocales(context, ...args),
    editText: (
      ...args: Parameters<typeof edit.editText> extends [unknown, ...infer Rest] ? Rest : never
    ) => edit.editText(context, ...args),
    resetOverride: (
      ...args: Parameters<typeof edit.resetOverride> extends [unknown, ...infer Rest] ? Rest : never
    ) => edit.resetOverride(context, ...args),
    confirmCorrection: (
      ...args: Parameters<typeof edit.confirmCorrection> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => edit.confirmCorrection(context, ...args),
    applyMachineBatch: (
      ...args: Parameters<typeof edit.applyMachineBatch> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => edit.applyMachineBatch(context, ...args),
    seal: (...args: Parameters<typeof read.seal> extends [unknown, ...infer Rest] ? Rest : never) =>
      read.seal(context, ...args),
  };
};
export type AppTranslationRepository = Awaited<ReturnType<typeof createAppTranslationRepository>>;
