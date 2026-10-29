import {
  catalogDigest,
  validateCatalogValue,
  type CatalogValue,
  catalogTextIsCurrent,
  type CatalogEditorData,
} from '@sva/plugin-sdk/app-translations';
import { type CatalogEditorModel } from './catalog.editor.state.js';

export const save = async (model: CatalogEditorModel) => {
  const { data, mutate, locale, key, input, setDirty, setInvalid, definition } = model;

  if (!definition) return;
  let value: CatalogValue;
  try {
    value = validateCatalogValue(
      data.draft.manifest,
      key,
      definition.type === 'stringArray' ? JSON.parse(input) : input
    );
  } catch {
    setInvalid(true);
    return;
  }
  const saved = await mutate({
    operation: 'edit',
    contractId: data.draft.manifest.contractId,
    expectedRevision: data.draft.draftRevision,
    locale,
    key,
    value,
  });
  if (saved) {
    setDirty(false);
    setInvalid(false);
  }
};

export const fieldOperation = (model: CatalogEditorModel, operation: 'reset' | 'confirm') => {
  const { data, mutate, locale, key } = model;
  return mutate({
    operation,
    contractId: data.draft.manifest.contractId,
    expectedRevision: data.draft.draftRevision,
    locale,
    key,
  });
};

export const translateKey = async (
  model: CatalogEditorModel,
  mode: 'standard' | 'municipal',
  targets: string[],
  confirmedTargets: readonly string[] = []
) => {
  const { data, translate, key } = model;

  if (
    !translate ||
    targets.some(
      (target) =>
        data.draft.valuesByLocale[target]?.[key]?.origin === 'manual' &&
        !confirmedTargets.includes(target)
    )
  )
    return;
  const sourceValue =
    mode === 'municipal' ? data.values.de?.[key]?.value : data.baseCatalogs.de?.values[key];
  const confirmations = Object.fromEntries(
    await Promise.all(
      targets
        .filter((target) => data.draft.valuesByLocale[target]?.[key]?.origin === 'manual')
        .map(async (target) => [
          target,
          {
            sourceDigest: await catalogDigest(sourceValue),
            overrideDigest: await catalogDigest(data.draft.valuesByLocale[target]?.[key]),
          },
        ])
    )
  );
  await translate({ mode, key, locales: targets, confirmations });
};

/** Match the release checks without changing or confirming any stored value. */
export const catalogSealIssues = async (data: CatalogEditorData, sourceOnly: boolean) => {
  const issues: {
    locale: string;
    key: string;
    reason: 'missing' | 'invalid_catalog' | 'reviewRequired';
  }[] = [];
  for (const locale of sourceOnly ? ['de'] : data.draft.supportedLocales) {
    for (const key of Object.keys(data.draft.manifest.keys)) {
      const text = data.values[locale]?.[key];
      if (!text) {
        issues.push({ locale, key, reason: 'missing' });
        continue;
      }
      try {
        validateCatalogValue(data.draft.manifest, key, text.value);
      } catch {
        issues.push({ locale, key, reason: 'invalid_catalog' });
        continue;
      }
      if (locale === 'de' || text.origin === 'default') continue;
      const source =
        text.sourceKind === 'standard'
          ? data.baseCatalogs.de?.values[key]
          : data.values.de?.[key]?.value;
      if (
        !(await catalogTextIsCurrent(
          text,
          source,
          text.origin === 'machine' || text.targetCode || locale === 'en'
            ? data.targetCodes?.[locale]
            : undefined
        ))
      )
        issues.push({ locale, key, reason: 'reviewRequired' });
    }
  }
  return issues;
};
