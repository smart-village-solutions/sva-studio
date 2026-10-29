import { useEffect, useState, useMemo, useRef } from 'react';
import {
  catalogTextIsCurrent,
  type CatalogEditorData,
  type AppTranslationLocale,
} from '@sva/plugin-sdk/app-translations';
import { useCatalogLanguages } from './catalog.languages.js';
export const useCatalogEditor = (props: CatalogEditorProps) => {
  const selection = useCatalogSelection(props);
  const field = useCatalogField(props, selection);
  const transfer = useCatalogTransfer(props.data, selection.locale, selection.key);
  return {
    ...props,
    ...selection,
    ...field,
    ...transfer,
    ...editorValues(props, selection.locale, selection.key),
  };
};
export type CatalogEditorModel = ReturnType<typeof useCatalogEditor>;

export const editorValues = (
  { data, canWrite, sourceOnly }: CatalogEditorProps,
  locale: string,
  key: string
) => {
  const canEdit = canWrite && (sourceOnly || locale !== 'de');
  const definition = data.draft.manifest.keys[key];
  const own = data.draft.valuesByLocale[locale]?.[key];
  const effective = data.values[locale]?.[key];
  const translationMode =
    data.draft.valuesByLocale.de?.[key]?.origin === 'manual' &&
    (effective?.sourceKind === 'municipal' || (own?.origin === 'manual' && !own.sourceKind))
      ? ('municipal' as const)
      : ('standard' as const);
  const source = editorSource(data, locale, key);
  const base =
    data.draft.machineStandardValuesByLocale?.[locale]?.[key]?.value ??
    data.baseCatalogs[locale]?.values[key];
  const savedValue = data.values[locale]?.[key]?.value;
  const savedInput =
    definition?.type === 'stringArray'
      ? JSON.stringify(savedValue ?? [], null, 2)
      : String(savedValue ?? '');
  return {
    canEdit,
    definition,
    own,
    effective,
    translationMode,
    source,
    base,
    savedValue,
    savedInput,
  };
};

export const useCatalogField = (
  props: CatalogEditorProps,
  selection: ReturnType<typeof useCatalogSelection>
) => {
  const { data, onDirtyChange } = props;
  const { locale, key } = selection;
  const { effective, source, savedInput } = editorValues(props, locale, key);
  const [input, setInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  useEffect(() => {
    setInput(savedInput);
    setDirty(false);
    setInvalid(false);
  }, [locale, key, savedInput]);
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
  return { input, setInput, dirty, setDirty, invalid, setInvalid, reviewRequired };
};
export const useCatalogTransfer = (
  data: CatalogEditorProps['data'],
  locale: string,
  key: string
) => {
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [transferTargets, setTransferTargets] = useState<string[]>([]);
  const [transferConfirmations, setTransferConfirmations] = useState<string[]>([]);
  const manualTransferTargets = transferTargets.filter(
    (target) => data.draft.valuesByLocale[target]?.[key]?.origin === 'manual'
  );
  useEffect(() => {
    setReplaceConfirmed(false);
    setTransferTargets([]);
    setTransferConfirmations([]);
  }, [locale, key, data.draft.draftRevision]);
  return {
    replaceConfirmed,
    setReplaceConfirmed,
    transferTargets,
    setTransferTargets,
    transferConfirmations,
    setTransferConfirmations,
    manualTransferTargets,
  };
};

export type CatalogEditorViewModel = CatalogEditorModel & {
  save: () => Promise<void>;
  fieldOperation: (operation: 'reset' | 'confirm') => Promise<boolean>;
  translateKey: (
    mode: 'standard' | 'municipal',
    targets: string[],
    confirmedTargets?: readonly string[]
  ) => Promise<void>;
};

const editorSource = (data: CatalogEditorProps['data'], locale: string, key: string) => {
  const effective = data.values[locale]?.[key];
  const own = data.draft.valuesByLocale[locale]?.[key];
  const source =
    locale !== 'de' &&
    effective &&
    (effective.sourceKind === 'standard' || (!own && effective.origin === 'default')) &&
    data.draft.scope.kind === 'municipal'
      ? data.baseCatalogs.de?.values[key]
      : data.values.de?.[key]?.value;
  return source;
};

export type CatalogEditorProps = {
  data: CatalogEditorData;
  requestedSelection?: { locale: string; key: string };
  canWrite: boolean;
  sourceOnly?: boolean;
  busy: boolean;
  mutate: (operation: Record<string, unknown>) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  translate?: (options: Record<string, unknown>) => Promise<boolean>;
};

export const useCatalogSelection = ({ data, requestedSelection }: CatalogEditorProps) => {
  const { pt, languageName } = useCatalogLanguages();
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
  const [selectedKey, setKey] = useState(Object.keys(data.draft.manifest.keys)[0] ?? '');
  const key = Object.prototype.hasOwnProperty.call(data.draft.manifest.keys, selectedKey)
    ? selectedKey
    : (Object.keys(data.draft.manifest.keys)[0] ?? '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (key === selectedKey) return;
    setKey(key);
    setQuery('');
    setPage(1);
  }, [key, selectedKey]);
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
  return {
    pt,
    languageName,
    locales,
    section,
    selectedLocale,
    setLocale,
    locale,
    key,
    setKey,
    query,
    setQuery,
    page,
    setPage,
    matchingKeys,
    pageCount,
    currentPage,
    visibleKeys,
  };
};
