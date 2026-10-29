import { type AppTranslationLocale } from '@sva/plugin-sdk/app-translations';
import { Button, Input, Select, StudioPagination } from '@sva/studio-ui-react';
import { type CatalogEditorViewModel } from './catalog.editor.state.js';

export const CatalogLocale = ({ model }: { model: CatalogEditorViewModel }) => {
  const { busy, pt, languageName, locales, setLocale, locale, setPage, dirty } = model;
  return (
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
  );
};

export const CatalogKeys = ({ model }: { model: CatalogEditorViewModel }) => {
  const {
    data,
    busy,
    pt,

    query,
    setQuery,

    setPage,
    dirty,
    matchingKeys,
    pageCount,
    currentPage,
    visibleKeys,
  } = model;
  return (
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
        {visibleKeys.map((candidate) => (
          <CatalogKeyRow key={candidate} candidate={candidate} model={model} />
        ))}
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
  );
};

export const CatalogKeyRow = ({
  model,
  candidate,
}: {
  model: CatalogEditorViewModel;
  candidate: string;
}) => {
  const { data, busy, pt, locale, key, setKey, dirty } = model;
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
};
