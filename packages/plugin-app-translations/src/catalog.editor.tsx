import { useEffect, useMemo, useState } from 'react';
import {
  APP_TRANSLATION_LOCALES,
  catalogDigest,
  validateCatalogValue,
  type AppTranslationLocale,
  type CatalogEditorData,
  type CatalogValue,
} from '@sva/plugin-sdk/app-translations';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioPagination, Textarea } from '@sva/studio-ui-react';

export const CatalogEditor = ({
  data,
  canWrite,
  sourceOnly = true,
  busy,
  mutate,
  onDirtyChange,
}: {
  data: CatalogEditorData;
  canWrite: boolean;
  sourceOnly?: boolean;
  busy: boolean;
  mutate: (operation: Record<string, unknown>) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
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
  const [selectedLocale, setLocale] = useState<AppTranslationLocale>('de');
  const locale = data.draft.supportedLocales.includes(selectedLocale) ? selectedLocale : 'de';
  const [key, setKey] = useState(Object.keys(data.draft.manifest.keys)[0] ?? '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
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
  const source =
    locale !== 'de' && !own && effective && data.draft.scope.kind === 'municipal'
      ? data.baseCatalogs.de?.values[key]
      : data.values.de?.[key]?.value;
  const base = data.baseCatalogs[locale]?.values[key];
  const savedValue = data.values[locale]?.[key]?.value;
  const savedInput =
    definition?.type === 'stringArray'
      ? JSON.stringify(savedValue ?? [], null, 2)
      : String(savedValue ?? '');
  useEffect(() => {
    setInput(savedInput);
    setDirty(false);
    setInvalid(false);
  }, [data, locale, key, savedInput]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    setReviewRequired(false);
    if (locale !== 'de' && own?.origin === 'manual' && source !== undefined)
      void catalogDigest(source).then((digest) => {
        if (active) setReviewRequired(digest !== own.confirmedSourceDigest);
      });
    return () => {
      active = false;
    };
  }, [locale, own, source]);
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
    await mutate({
      operation: 'edit',
      contractId: data.draft.manifest.contractId,
      expectedRevision: data.draft.draftRevision,
      locale,
      key,
      value,
    });
  };
  const fieldOperation = (operation: 'reset' | 'confirm') =>
    mutate({
      operation,
      contractId: data.draft.manifest.contractId,
      expectedRevision: data.draft.draftRevision,
      locale,
      key,
    });
  return (
    <section
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
              <dd>{pt(!effective ? 'missing' : own ? 'own' : 'inherited')}</dd>
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
            {reviewRequired && (
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
