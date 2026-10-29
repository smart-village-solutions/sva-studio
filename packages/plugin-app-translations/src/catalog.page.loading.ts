import { useEffect } from 'react';
import {
  catalogTranslationSource,
  type CatalogOverview,
  type CatalogEditorData,
} from '@sva/plugin-sdk/app-translations';
import { errorCode, type TranslationJob, type CatalogPageModel } from './catalog.page.state.js';
export const useCatalogOverview = (model: CatalogPageModel) => {
  const {
    setOverview,

    setContractId,
    setData,
    setPreviews,
    setBaseId,
    setChoosingBase,
    setDirty,
    setError,
    setSealIssues,
    setRequestedSelection,
    reload,
    setJob,
    setRecentJobId,
    sourceOnly,
    platform,
    catalog,
  } = model;
  useEffect(() => {
    const controller = new AbortController();
    setOverview(null);
    setError('');
    setData(null);
    setJob(null);
    setRecentJobId(null);
    setDirty(false);
    setPreviews({});
    setChoosingBase(false);
    setBaseId('');
    setSealIssues([]);
    setRequestedSelection(undefined);
    void catalog<CatalogOverview>({ operation: 'overview' }, undefined, controller.signal)
      .then((result) => {
        if ((result.scope.kind === 'global') !== platform) {
          setError('catalog_forbidden');
          return;
        }
        setOverview(result);
        setContractId((current) =>
          result.catalogs.some((row) => row.contractId === current)
            ? current
            : (result.catalogs[0]?.contractId ?? '')
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorCode(reason));
      });
    return () => controller.abort();
  }, [platform, sourceOnly, reload]);
};

export const useCatalogDraft = (model: CatalogPageModel) => {
  const {
    overview,
    contractId,
    setData,
    setPreviews,
    setBaseId,
    setChoosingBase,
    setDirty,
    setError,
    setSealIssues,
    setRequestedSelection,
    reload,
    setJob,
    setRecentJobId,
    catalog,
  } = model;
  useEffect(() => {
    if (!overview || !contractId) return;
    const controller = new AbortController();
    setData(null);
    setJob(null);
    setRecentJobId(null);
    setDirty(false);
    setPreviews({});
    setChoosingBase(false);
    setBaseId('');
    setSealIssues([]);
    setRequestedSelection(undefined);
    setError('');
    void catalog<CatalogEditorData>(
      { operation: 'read', contractId },
      overview.scope,
      controller.signal
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorCode(reason));
      });
    return () => controller.abort();
  }, [
    contractId,
    overview?.scope.kind,
    overview?.scope.kind === 'municipal' ? overview.scope.organizationId : '',
    reload,
  ]);
};

export const useCatalogJob = (model: CatalogPageModel) => {
  const {
    overview,
    contractId,
    setData,
    dirty,
    setError,
    setJob,
    setRecentJobId,
    jobVersion,
    sourceOnly,
    catalog,
  } = model;
  useEffect(() => {
    if (sourceOnly || !overview || !contractId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const current = await catalog<TranslationJob>(
          { operation: 'translationStatus', contractId },
          overview.scope,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setJob(current);
        if (current && ['queued', 'running', 'retrying'].includes(current.status)) {
          setRecentJobId(current.id);
          timer = setTimeout(() => void poll(), 2000);
        } else if (current && !dirty) {
          const updated = await catalog<CatalogEditorData>(
            { operation: 'read', contractId },
            overview.scope,
            controller.signal
          );
          if (!controller.signal.aborted) setData(updated);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorCode(reason));
      }
    };
    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [
    sourceOnly,
    contractId,
    overview?.scope.kind === 'municipal' ? overview.scope.organizationId : '',
    jobVersion,
    dirty,
  ]);
};

export const useCatalogCounts = (model: CatalogPageModel) => {
  const { data, setTranslationCounts, sourceOnly } = model;
  useEffect(() => {
    let active = true;
    setTranslationCounts(null);
    if (data && !sourceOnly)
      void Promise.all(
        data.draft.supportedLocales
          .filter((locale) => locale !== 'de')
          .map(async (locale) => {
            let count = 0;
            for (const key of Object.keys(data.draft.manifest.keys))
              if (
                (await catalogTranslationSource(
                  data,
                  'missing',
                  locale,
                  key,
                  data.targetCodes?.[locale] ?? locale
                )) !== undefined
              )
                count++;
            return [locale, count] as const;
          })
      )
        .then((counts) => {
          if (active) setTranslationCounts(Object.fromEntries(counts));
        })
        .catch(() => {
          if (active) setTranslationCounts(null);
        });
    return () => {
      active = false;
    };
  }, [data, sourceOnly]);
};
