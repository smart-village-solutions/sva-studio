import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APP_TRANSLATION_LOCALES,
  catalogDigest,
  catalogTextIsCurrent,
  validateCatalogValue,
  type AppTranslationLocale,
  type CatalogEditorData,
  type CatalogValue,
} from '@sva/plugin-sdk/app-translations';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, Select, StudioPagination, Textarea } from '@sva/studio-ui-react';

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

export const CatalogEditor = ({
  data,
  canWrite,
  sourceOnly = true,
  busy,
  mutate,
  onDirtyChange,
  translate,
  requestedSelection,
}: {
  data: CatalogEditorData;
  requestedSelection?: { locale: string; key: string };
  canWrite: boolean;
  sourceOnly?: boolean;
  busy: boolean;
  mutate: (operation: Record<string, unknown>) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  translate?: (options: Record<string, unknown>) => Promise<boolean>;
}) => {
  const pt = usePluginTranslation('appTranslations.ui');
  const displayNames = new Intl.DisplayNames([pt('languageTag') === 'en' ? 'en' : 'de'], {
    type: 'language',
  });
  const languageName = (locale: string) =>
    (APP_TRANSLATION_LOCALES as readonly string[]).includes(locale)
      ? pt(`locales.${locale}`)
      : (displayNames.of(locale) ?? locale);
  const locales = [...data.draft.supportedLocales].sort(
    (left, right) =>
      Number(right === 'de') - Number(left === 'de') ||
      languageName(left).localeCompare(
        languageName(right),
        pt('languageTag') === 'en' ? 'en' : 'de'
      )
  );
  const section = useRef<HTMLElement>(null);
  const [selectedLocale, setLocale] = useState<AppTranslationLocale>('de');
  const locale = data.draft.supportedLocales.includes(selectedLocale) ? selectedLocale : 'de';
  const [key, setKey] = useState(Object.keys(data.draft.manifest.keys)[0] ?? '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [transferTargets, setTransferTargets] = useState<string[]>([]);
  const [transferConfirmations, setTransferConfirmations] = useState<string[]>([]);
  const manualTransferTargets = transferTargets.filter(
    (target) => data.draft.valuesByLocale[target]?.[key]?.origin === 'manual'
  );
  const [reviewRequired, setReviewRequired] = useState(false);
  useEffect(() => {
    if (!requestedSelection) return;
    setLocale(requestedSelection.locale);
    setKey(requestedSelection.key);
    setQuery('');
    setPage(
      Math.floor(Object.keys(data.draft.manifest.keys).indexOf(requestedSelection.key) / 25) + 1
    );
    section.current?.focus();
    section.current?.scrollIntoView?.({ block: 'start' });
  }, [requestedSelection]);

  const matchingKeys = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return Object.keys(data.draft.manifest.keys).filter((candidate) => {
      const german =
        data.values.de?.[candidate]?.value ?? data.draft.manifest.keys[candidate]?.defaultValue;
      const translated = data.values[locale]?.[candidate]?.value;
      return [candidate, german, translated].some((value) =>
        (Array.isArray(value) ? value.join(' ') : String(value ?? ''))
          .toLocaleLowerCase()
          .includes(term)
      );
    });
  }, [data, locale, query]);
  const pageCount = Math.max(1, Math.ceil(matchingKeys.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visibleKeys = matchingKeys.slice((currentPage - 1) * 25, currentPage * 25);
  const canEdit = canWrite && (sourceOnly || locale !== 'de');
  const definition = data.draft.manifest.keys[key];
  const own = data.draft.valuesByLocale[locale]?.[key];
  const effective = data.values[locale]?.[key];
  const translationMode =
    data.draft.valuesByLocale.de?.[key]?.origin === 'manual' &&
    (effective?.sourceKind === 'municipal' || (own?.origin === 'manual' && !own.sourceKind))
      ? 'municipal'
      : 'standard';
  const source =
    locale !== 'de' &&
    effective &&
    (effective.sourceKind === 'standard' || (!own && effective.origin === 'default')) &&
    data.draft.scope.kind === 'municipal'
      ? data.baseCatalogs.de?.values[key]
      : data.values.de?.[key]?.value;
  const base =
    data.draft.machineStandardValuesByLocale?.[locale]?.[key]?.value ??
    data.baseCatalogs[locale]?.values[key];
  const savedValue = data.values[locale]?.[key]?.value;
  const savedInput =
    definition?.type === 'stringArray'
      ? JSON.stringify(savedValue ?? [], null, 2)
      : String(savedValue ?? '');
  useEffect(() => {
    setInput(savedInput);
    setDirty(false);
    setInvalid(false);
  }, [locale, key, savedInput]);
  useEffect(() => {
    setReplaceConfirmed(false);
    setTransferTargets([]);
    setTransferConfirmations([]);
  }, [locale, key, data.draft.draftRevision]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    setReviewRequired(false);
    if (locale !== 'de' && effective && effective.origin !== 'default')
      void catalogTextIsCurrent(
        effective,
        source,
        effective.origin === 'machine' || effective.targetCode || locale === 'en'
          ? data.targetCodes?.[locale]
          : undefined
      ).then((current) => {
        if (active) setReviewRequired(!current);
      });
    return () => {
      active = false;
    };
  }, [locale, effective, source, data.targetCodes]);
  if (!definition) return <p>{pt('empty')}</p>;
  const save = async () => {
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
  const fieldOperation = (operation: 'reset' | 'confirm') =>
    mutate({
      operation,
      contractId: data.draft.manifest.contractId,
      expectedRevision: data.draft.draftRevision,
      locale,
      key,
    });
  const translateKey = async (
    mode: 'standard' | 'municipal',
    targets: string[],
    confirmedTargets: readonly string[] = []
  ) => {
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
              overrideDigest: await catalogDigest(data.draft.valuesByLocale[target]![key]),
            },
          ])
      )
    );
    await translate({ mode, key, locales: targets, confirmations });
  };
  return (
    <section
      ref={section}
      tabIndex={-1}
      className="space-y-5 rounded-lg border border-border bg-card p-6"
      aria-labelledby="catalog-editor-heading"
    >
      <h2 id="catalog-editor-heading" className="text-xl font-semibold">
        {pt('editor')}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          {pt('language')}
          <Select
            value={locale}
            disabled={busy || dirty}
            onChange={(event) => {
              setLocale(event.target.value as AppTranslationLocale);
              setPage(1);
            }}
          >
            {locales.map((value) => (
              <option key={value} value={value}>
                {languageName(value)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-3">
          <label className="block space-y-2">
            {pt('search')}
            <Input
              type="search"
              value={query}
              disabled={busy || dirty}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <p role="status" className="text-sm text-muted-foreground">
            {pt('matches', {
              count: matchingKeys.length,
              total: Object.keys(data.draft.manifest.keys).length,
            })}
          </p>
          <ul
            aria-label={pt('key')}
            className="max-h-96 overflow-y-auto rounded-md border border-border"
          >
            {visibleKeys.map((candidate) => {
              const value = data.values[locale]?.[candidate]?.value;
              return (
                <li key={candidate} className="border-b border-border last:border-b-0">
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={busy || dirty}
                    aria-pressed={candidate === key}
                    onClick={() => setKey(candidate)}
                    className="block w-full min-w-0 whitespace-normal rounded-none px-3 py-2 text-left aria-pressed:bg-accent"
                  >
                    <span className="block break-all font-mono text-sm">{candidate}</span>
                    <span lang={locale} className="block truncate text-sm text-muted-foreground">
                      {value === undefined
                        ? pt('missing')
                        : Array.isArray(value)
                          ? value.join(' · ')
                          : value === ''
                            ? pt('emptyValue')
                            : value}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {matchingKeys.length === 0 && <p>{pt('noMatches')}</p>}
          {pageCount > 1 && (
            <StudioPagination
              page={currentPage}
              hasNextPage={currentPage < pageCount}
              disabled={busy || dirty}
              onPageChange={setPage}
              ariaLabel={pt('keyPages')}
              pageLabel={pt('page', { page: currentPage, total: pageCount })}
              previousLabel={pt('previous')}
              nextLabel={pt('next')}
            />
          )}
        </div>
        <div className="min-w-0 space-y-5">
          <h3 className="break-all font-mono text-sm font-medium">{key}</h3>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{pt('type')}</dt>
              <dd>{definition.type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{pt('placeholders')}</dt>
              <dd>
                {Object.entries(definition.placeholders)
                  .map(([name, type]) => `${name}: ${type}`)
                  .join(', ') || pt('none')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{pt('origin')}</dt>
              <dd>
                {pt(
                  !effective
                    ? 'missing'
                    : effective.origin === 'machine'
                      ? 'machine'
                      : own
                        ? 'own'
                        : 'inherited'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{pt('status')}</dt>
              <dd>{pt(reviewRequired ? 'reviewRequired' : effective ? 'complete' : 'missing')}</dd>
            </div>
          </dl>
          <label className="block space-y-2">
            {pt('value')}
            <Textarea
              lang={locale}
              dir="auto"
              value={input}
              disabled={!canEdit || busy}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'catalog-value-error' : 'catalog-value-help'}
              onChange={(event) => {
                setInput(event.target.value);
                setDirty(true);
                setInvalid(false);
              }}
            />
          </label>
          <p id="catalog-value-help" className="text-sm text-muted-foreground">
            {pt(
              definition.type === 'stringArray'
                ? 'arrayHelp'
                : definition.allowEmpty
                  ? 'emptyAllowed'
                  : 'valueHelp'
            )}
          </p>
          {invalid && (
            <p id="catalog-value-error" role="alert" className="text-destructive">
              {pt('invalid_catalog')}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!canEdit || busy || (!dirty && !(definition.allowEmpty && !effective))}
              onClick={() => void save()}
            >
              {pt('save')}
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setInput(savedInput);
                  setDirty(false);
                  setInvalid(false);
                }}
              >
                {pt('discard')}
              </Button>
            )}
            {data.draft.scope.kind === 'municipal' && (
              <Button
                type="button"
                variant="secondary"
                disabled={!canEdit || busy || dirty || !own}
                onClick={() => void fieldOperation('reset')}
              >
                {pt('reset')}
              </Button>
            )}
            {reviewRequired && own?.origin === 'manual' && (
              <Button
                type="button"
                variant="secondary"
                disabled={!canEdit || busy || dirty}
                onClick={() => void fieldOperation('confirm')}
              >
                {pt('confirm')}
              </Button>
            )}
          </div>
          {!sourceOnly && canWrite && translate && locale !== 'de' && (
            <div className="space-y-2">
              {own?.origin === 'manual' && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    type="checkbox"
                    checked={replaceConfirmed}
                    disabled={busy || dirty}
                    onChange={(event) => setReplaceConfirmed(event.target.checked)}
                  />
                  {pt('replaceManual')}
                </label>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={busy || dirty || (own?.origin === 'manual' && !replaceConfirmed)}
                onClick={() =>
                  void translateKey(
                    translationMode,
                    [locale],
                    replaceConfirmed ? [locale] : []
                  )
                }
              >
                {pt('translateKey')}
              </Button>
            </div>
          )}
          {!sourceOnly &&
            canWrite &&
            translate &&
            locale === 'de' &&
            data.draft.scope.kind === 'municipal' &&
            own?.origin === 'manual' && (
              <fieldset
                className="space-y-2 rounded-md border border-border p-3"
                disabled={busy || dirty}
              >
                <legend>{pt('transferMunicipal')}</legend>
                <p className="text-sm text-muted-foreground">{pt('transferHelp')}</p>
                {locales
                  .filter((target) => target !== 'de')
                  .map((target) => (
                    <label key={target} className="flex items-center gap-2">
                      <Checkbox
                        type="checkbox"
                        checked={transferTargets.includes(target)}
                        onChange={(event) => {
                          setTransferTargets((current) =>
                            event.target.checked
                              ? [...current, target]
                              : current.filter((entry) => entry !== target)
                          );
                          setTransferConfirmations([]);
                        }}
                      />
                      {languageName(target)}
                    </label>
                  ))}
                {manualTransferTargets.length > 0 && (
                  <div
                    role="group"
                    aria-label={pt('replaceManualTargets')}
                    className="space-y-2 border-t border-border pt-3"
                  >
                    <p className="text-sm font-medium">{pt('replaceManualTargets')}</p>
                    {manualTransferTargets.map((target) => (
                      <label key={target} className="flex items-center gap-2">
                        <Checkbox
                          type="checkbox"
                          checked={transferConfirmations.includes(target)}
                          onChange={(event) =>
                            setTransferConfirmations((current) =>
                              event.target.checked
                                ? [...current, target]
                                : current.filter((entry) => entry !== target)
                            )
                          }
                        />
                        {languageName(target)} · {pt('replaceManual')}
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    busy ||
                    dirty ||
                    !transferTargets.length ||
                    manualTransferTargets.some((target) => !transferConfirmations.includes(target))
                  }
                  onClick={() =>
                    void translateKey('municipal', transferTargets, transferConfirmations)
                  }
                >
                  {pt('transferMunicipal')}
                </Button>
              </fieldset>
            )}
          {dirty && (
            <p role="status" className="text-sm text-muted-foreground">
              {pt('unsaved')}
            </p>
          )}
          <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">{pt('source')}</h3>
              <pre lang="de" className="whitespace-pre-wrap break-words text-sm">
                {typeof source === 'string' ? source : JSON.stringify(source ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium">{pt('standard')}</h3>
              <pre dir="auto" lang={locale} className="whitespace-pre-wrap break-words text-sm">
                {base === undefined
                  ? pt('none')
                  : typeof base === 'string'
                    ? base
                    : JSON.stringify(base, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
