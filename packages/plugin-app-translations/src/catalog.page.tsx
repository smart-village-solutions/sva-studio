import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  APP_TRANSLATION_LOCALES,
  catalogTranslationSource,
  validateCatalogManifest,
  type CatalogDraft,
  type CatalogEditorData,
  type CatalogOverview,
  type CatalogRelease,
} from '@sva/plugin-sdk/app-translations';
import {
  MainserverApiError,
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { Button, Input, Select, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import { requestCatalog, requestCatalogDownload } from './catalog.api.js';
import { CatalogEditor, catalogSealIssues } from './catalog.editor.js';

type ReleasePreview =
  { status: 'loading' } | { status: 'ready'; release: CatalogRelease } | { status: 'error' };

type TranslationJob = {
  id: string;
  status: string;
  progress?: {
    completedSteps: number;
    totalSteps: number;
    details?: { locale?: string; translated?: number; skipped?: number };
  };
  error?: string;
} | null;
const errorCode = (error: unknown) =>
  error instanceof MainserverApiError ? error.code : 'catalog_unavailable';
export const CatalogsPage = ({
  platform = false,
  sourceOnly = true,
}: { platform?: boolean; sourceOnly?: boolean } = {}) => {
  const pt = usePluginTranslation('appTranslations.ui');
  const displayNames = new Intl.DisplayNames([pt('languageTag') === 'en' ? 'en' : 'de'], {
    type: 'language',
  });
  const languageName = (locale: string) =>
    (APP_TRANSLATION_LOCALES as readonly string[]).includes(locale)
      ? pt(`locales.${locale}`)
      : (displayNames.of(locale) ?? locale);
  const languageNames = (locales: readonly string[]) =>
    [...locales]
      .sort(
        (left, right) =>
          Number(right === 'de') - Number(left === 'de') ||
          languageName(left).localeCompare(
            languageName(right),
            pt('languageTag') === 'en' ? 'en' : 'de'
          )
      )
      .map(languageName)
      .join(', ');
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [contractId, setContractId] = useState('');
  const [data, setData] = useState<CatalogEditorData | null>(null);
  const [previews, setPreviews] = useState<Record<string, ReleasePreview>>({});
  const [baseId, setBaseId] = useState('');
  const [choosingBase, setChoosingBase] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const downloadController = useRef<AbortController | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  useEffect(() => {
    setDownloadingId(null);
    return () => downloadController.current?.abort();
  }, [overview, sourceOnly]);
  const [notice, setNotice] = useState('');
  const [sealIssues, setSealIssues] = useState<Awaited<ReturnType<typeof catalogSealIssues>>>([]);
  const [requestedSelection, setRequestedSelection] = useState<{ locale: string; key: string }>();
  const [reload, setReload] = useState(0);
  const [job, setJob] = useState<TranslationJob>(null);
  const [recentJobId, setRecentJobId] = useState<string | null>(null);
  const [translationCounts, setTranslationCounts] = useState<Record<string, number> | null>(null);
  const jobActive = Boolean(job && ['queued', 'running', 'retrying'].includes(job.status));
  const hasMissingTranslations = Object.values(translationCounts ?? {}).some((count) => count > 0);
  const showJobProgress = jobActive || job?.id === recentJobId || hasMissingTranslations;
  const [jobVersion, setJobVersion] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  const permissionNamespace = sourceOnly ? 'app-texts' : 'app-translations';
  const ready = sourceOnly || overview?.setup?.ready === true;
  const canWrite =
    ready &&
    (platform || access.permissionActions.includes(`${permissionNamespace}.catalog.write`));
  const canPublish =
    ready &&
    (platform || access.permissionActions.includes(`${permissionNamespace}.catalog.publish`));
  const catalog = <T,>(
    operation: Readonly<Record<string, unknown>>,
    scope?: CatalogOverview['scope'],
    signal?: AbortSignal
  ) => requestCatalog<T>(operation, scope, signal, sourceOnly ? 'source' : 'translations');
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
  const translate = async (options: Record<string, unknown>) => {
    if (!overview || !data || busy || dirty || jobActive) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = await catalog<TranslationJob>(
        {
          operation: 'translate',
          contractId,
          expectedRevision: data.draft.draftRevision,
          ...options,
        },
        overview.scope
      );
      setJob(current);
      if (current) {
        setRecentJobId(current.id);
        setJobVersion((value) => value + 1);
      } else setNotice('nothingToTranslate');
      return true;
    } catch (reason) {
      setError(errorCode(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (operation: Record<string, unknown>): Promise<boolean> => {
    if (!overview || busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await catalog<CatalogDraft | CatalogRelease>(operation, overview.scope);
      const nextContract = 'manifest' in result ? result.manifest.contractId : result.contractId;
      const nextData = await catalog<CatalogEditorData>(
        { operation: 'read', contractId: nextContract },
        overview.scope
      );
      const nextOverview = await catalog<CatalogOverview>(
        { operation: 'overview' },
        overview.scope
      );
      setOverview(nextOverview);
      setContractId(nextContract);
      setData(nextData);
      setDirty(false);
      if ('state' in result && result.state === 'sealed')
        setPreviews((current) => ({
          ...current,
          [result.id]: { status: 'ready', release: result },
        }));
      setSealIssues([]);
      setNotice('state' in result && result.state === 'sealed' ? 'sealed' : 'saved');
      return true;
    } catch (reason) {
      setError(errorCode(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (file: File | undefined) => {
    if (!file || !overview) return;
    if (file.size > 1048576) {
      setError('invalid_catalog');
      return;
    }
    try {
      const manifest = validateCatalogManifest(JSON.parse(await file.text()));
      const revision =
        overview.catalogs.find((row) => row.contractId === manifest.contractId)?.draftRevision ??
        '0';
      await mutate({ operation: 'import', manifest, expectedRevision: revision, locales: ['de'] });
    } catch {
      setError('invalid_catalog');
    }
  };
  const releases =
    overview?.releases.filter((release) => !contractId || release.contractId === contractId) ?? [];
  const savedDraftRelease = releases.find(
    (release) => release.draftRevision === data?.draft.draftRevision
  );
  const draftStatus = dirty
    ? 'draftUnsaved'
    : jobActive
      ? 'draftTranslating'
      : savedDraftRelease
        ? 'draftSealed'
        : 'draftUnsealed';
  const canSeal = canPublish && !busy && !dirty && !jobActive && !savedDraftRelease;
  const selectedBase = overview?.bases.find((base) => base.id === baseId);
  const existingDraft = overview?.catalogs.find((row) => row.contractId === contractId);
  const currentBaseId = data?.draft.baseReleaseId ?? existingDraft?.baseReleaseId;
  const currentBase = overview?.bases.find((base) => base.id === currentBaseId);
  const availableBases =
    overview?.bases.filter(
      (base) => !existingDraft || (base.contractId === contractId && base.id !== currentBaseId)
    ) ?? [];
  const applyBase = async () => {
    if (!selectedBase || (existingDraft && !data)) return;
    const saved = await mutate(
      existingDraft && data
        ? {
            operation: 'changeBase',
            contractId,
            expectedRevision: data.draft.draftRevision,
            baseReleaseId: selectedBase.id,
            locales: ['de'],
          }
        : {
            operation: 'createMunicipal',
            baseReleaseId: selectedBase.id,
            locales: ['de'],
          }
    );
    if (saved) {
      setChoosingBase(false);
      setBaseId('');
    }
  };
  const downloadTexts = async (releaseId: string) => {
    if (!overview) return;
    downloadController.current?.abort();
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloadingId(releaseId);
    setError('');
    setNotice('');
    try {
      const blob = await requestCatalogDownload(
        releaseId,
        overview.scope,
        controller.signal,
        sourceOnly ? 'source' : 'translations'
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'texts.js';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice('downloadedTexts');
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorCode(cause));
    } finally {
      if (!controller.signal.aborted) setDownloadingId(null);
    }
  };
  const loadPreview = async (id: string) => {
    if (!overview || previews[id]?.status === 'loading' || previews[id]?.status === 'ready') return;
    setPreviews((current) => ({ ...current, [id]: { status: 'loading' } }));
    try {
      const release = await catalog<CatalogRelease>(
        { operation: 'readRelease', releaseId: id },
        overview.scope
      );
      setPreviews((current) => ({ ...current, [id]: { status: 'ready', release } }));
    } catch (reason) {
      setPreviews((current) => ({ ...current, [id]: { status: 'error' } }));
      setError(errorCode(reason));
    }
  };
  const seal = async () => {
    if (!data || !canSeal) return;
    setBusy(true);
    try {
      const issues = await catalogSealIssues(data, sourceOnly);
      setSealIssues(issues);
      if (issues.length) return;
      await mutate({ operation: 'seal', contractId, expectedRevision: data.draft.draftRevision });
    } finally {
      setBusy(false);
    }
  };
  const reloadCatalog = () => {
    setEditorVersion((value) => value + 1);
    setReload((value) => value + 1);
  };
  return (
    <StudioOverviewPageTemplate
      title={pt(platform ? 'standardsTitle' : sourceOnly ? 'sourceTitle' : 'title')}
      description={pt(
        platform ? 'standardsDescription' : sourceOnly ? 'sourceDescription' : 'description'
      )}
      primaryAction={
        <Button type="button" variant="secondary" disabled={busy || dirty} onClick={reloadCatalog}>
          {pt('reload')}
        </Button>
      }
    >
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive"
        >
          {pt(
            [
              'catalog_export_incompatible',
              'catalog_setup_required',
              'deepl_text_too_large',
              'catalog_conflict',
              'catalog_incomplete',
              'catalog_review_required',
              'catalog_forbidden',
              'catalog_not_found',
              'invalid_catalog',
            ].includes(error)
              ? error
              : 'catalog_unavailable'
          )}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {pt(notice)}
        </p>
      )}
      {!overview && !error && <p role="status">{pt('loading')}</p>}
      {overview && (
        <>
          <p className="text-sm text-muted-foreground">
            {pt('scope')}:{' '}
            {overview.scope.kind === 'global'
              ? pt('global')
              : `${overview.scope.instanceId} / ${overview.scope.organizationId}`}
          </p>
          {!sourceOnly && overview.setup && (
            <section
              role="status"
              className="space-y-2 rounded-lg border border-border bg-card p-5"
            >
              <h2 className="font-semibold">{pt(ready ? 'setupReady' : 'setupTitle')}</h2>
              <p>{pt(`setupReasons.${overview.setup.reason}`)}</p>
              {overview.canManageInterfaces ? (
                <a className="underline" href="/interfaces">
                  {pt('setupLink')}
                </a>
              ) : (
                <p>{pt('setupAdmin')}</p>
              )}
            </section>
          )}
          {platform && (
            <section
              className="space-y-4 rounded-lg border border-border bg-card p-6"
              aria-labelledby="catalog-import-heading"
            >
              <h2 id="catalog-import-heading" className="text-lg font-semibold">
                {pt('import')}
              </h2>
              <p className="text-sm text-muted-foreground">{pt('importHelp')}</p>

              <label className="block space-y-2">
                {pt('importFile')}
                <Input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy || dirty}
                  onChange={(event) => {
                    void importFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            </section>
          )}
          <section className="space-y-3" aria-labelledby="catalog-overview-heading">
            <h2 id="catalog-overview-heading" className="text-lg font-semibold">
              {pt('catalogs')}
            </h2>
            {overview.catalogs.length === 0 ? (
              <p>{pt('empty')}</p>
            ) : (
              <label className="block space-y-2">
                {pt('catalog')}
                <Select
                  value={contractId}
                  disabled={busy || dirty}
                  onChange={(event) => {
                    setContractId(event.target.value);
                    setBaseId('');
                  }}
                >
                  {overview.catalogs.map((catalog) => (
                    <option key={catalog.contractId} value={catalog.contractId}>
                      {catalog.contractId}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </section>
          {!platform && sourceOnly && (
            <section
              className="space-y-3 rounded-lg border border-border p-5"
              aria-labelledby="catalog-base-heading"
            >
              <h2 id="catalog-base-heading" className="font-semibold">
                {pt('basis')}
              </h2>
              {existingDraft && (
                <>
                  <p className="text-sm">
                    {pt('currentBasis')}:{' '}
                    {currentBase
                      ? `${currentBase.contractId} / ${currentBase.catalogSetRevision} / ${languageNames(currentBase.supportedLocales)}`
                      : (currentBaseId ?? pt('none'))}
                  </p>
                  {!choosingBase && availableBases.length > 0 && canWrite && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || dirty || !data}
                      onClick={() => setChoosingBase(true)}
                    >
                      {pt('switchBasis')}
                    </Button>
                  )}
                </>
              )}
              {(!existingDraft || choosingBase) && (
                <>
                  <label className="block space-y-2">
                    {pt('chooseBasis')}
                    <Select
                      value={baseId}
                      disabled={busy || dirty || !canWrite}
                      onChange={(event) => setBaseId(event.target.value)}
                    >
                      <option value="">{pt('choose')}</option>
                      {availableBases.map((base) => (
                        <option key={base.id} value={base.id}>
                          {base.contractId} / {base.catalogSetRevision} /{' '}
                          {languageNames(base.supportedLocales)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        busy ||
                        dirty ||
                        !canWrite ||
                        !selectedBase ||
                        Boolean(existingDraft && !data)
                      }
                      onClick={() => void applyBase()}
                    >
                      {pt(existingDraft ? 'changeBasis' : 'create')}
                    </Button>
                    {existingDraft && (
                      <Button
                        type="button"
                        variant="tertiary"
                        disabled={busy}
                        onClick={() => {
                          setChoosingBase(false);
                          setBaseId('');
                        }}
                      >
                        {pt('cancelBasisChange')}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
          {!sourceOnly && overview.catalogs.length === 0 && <p>{pt('sourceRequired')}</p>}
          {contractId && !data && !error && <p role="status">{pt('loading')}</p>}
          {data && (
            <>
              {!sourceOnly && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{pt('configureLanguagesHelp')}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canWrite || busy || dirty}
                    onClick={() =>
                      void mutate({
                        operation: 'configureLocales',
                        contractId,
                        expectedRevision: data.draft.draftRevision,
                      })
                    }
                  >
                    {pt('configureLanguages')}
                  </Button>
                </div>
              )}
              {!sourceOnly && (
                <section className="space-y-3" aria-label={pt('translateMissing')}>
                  <p className="text-sm text-muted-foreground">{pt('translateHelp')}</p>
                  {translationCounts && (
                    <p className="text-sm text-muted-foreground">
                      {pt('translationPlan', {
                        count: Object.values(translationCounts).reduce(
                          (sum, count) => sum + count,
                          0
                        ),
                      })}{' '}
                      {Object.entries(translationCounts)
                        .map(([locale, count]) => `${languageName(locale)}: ${count}`)
                        .join(' · ')}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canWrite || busy || dirty || jobActive || !hasMissingTranslations}
                    onClick={() => void translate({ mode: 'missing' })}
                  >
                    {pt('translateMissing')}
                  </Button>
                  {showJobProgress && job && (
                    <p role="status">
                      {pt(`jobStatus.${job.status}`)}{' '}
                      {job.progress
                        ? `${job.progress.completedSteps} / ${job.progress.totalSteps}`
                        : ''}
                    </p>
                  )}
                  {showJobProgress &&
                    typeof job?.progress?.details?.translated === 'number' &&
                    typeof job.progress.details.skipped === 'number' && (
                      <p className="text-sm text-muted-foreground">
                        {job.progress.details.locale
                          ? `${languageName(job.progress.details.locale)} · `
                          : ''}
                        {pt('translationProgress', {
                          translated: job.progress.details.translated ?? 0,
                          skipped: job.progress.details.skipped ?? 0,
                          pending: job.progress.totalSteps - job.progress.completedSteps,
                        })}
                      </p>
                    )}
                  {job?.error && (
                    <p role="alert" className="text-destructive">
                      {pt(job.error)}
                    </p>
                  )}
                </section>
              )}
              <CatalogEditor
                key={`${data.draft.id}:${editorVersion}`}
                data={data}
                requestedSelection={requestedSelection}
                busy={busy}
                canWrite={canWrite}
                sourceOnly={sourceOnly}
                mutate={mutate}
                onDirtyChange={setDirty}
                translate={!sourceOnly && !jobActive ? translate : undefined}
              />
              <section
                className={`space-y-3 rounded-lg border p-4 ${
                  draftStatus === 'draftSealed'
                    ? 'border-border bg-card'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                }`}
                aria-labelledby="catalog-draft-heading"
              >
                <h2 id="catalog-draft-heading" className="text-lg font-semibold">
                  {pt(draftStatus === 'draftSealed' ? 'currentStateTitle' : 'draftTitle')}
                </h2>
                <p role="status" className="font-medium">
                  {pt(draftStatus, { revision: savedDraftRelease?.catalogSetRevision ?? '' })}
                </p>
                <dl className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <dt>{pt('manifest')}</dt>
                    <dd>{data.draft.manifest.manifestVersion}</dd>
                  </div>
                  <div>
                    <dt>{pt('draftRevision')}</dt>
                    <dd>{data.draft.draftRevision}</dd>
                  </div>
                  <div>
                    <dt>{pt('basis')}</dt>
                    <dd>{data.draft.baseReleaseId ?? pt('none')}</dd>
                  </div>
                  <div>
                    <dt>{pt('languages')}</dt>
                    <dd>{languageNames(data.draft.supportedLocales)}</dd>
                  </div>
                </dl>
                <Button type="button" disabled={!canSeal} onClick={() => void seal()}>
                  {pt('seal')}
                </Button>
              </section>
              {sealIssues.length > 0 && (
                <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-4">
                  <p>{pt('sealBlocked')}</p>
                  <ul className="max-h-64 overflow-auto">
                    {sealIssues.map((issue) => (
                      <li key={`${issue.locale}:${issue.key}`}>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={busy || dirty}
                          onClick={() =>
                            setRequestedSelection({ locale: issue.locale, key: issue.key })
                          }
                        >
                          {languageName(issue.locale)} · {issue.key} · {pt(issue.reason)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <section
            className="space-y-3 border-t border-border pt-5"
            aria-labelledby="catalog-releases-heading"
          >
            <h2 id="catalog-releases-heading" className="text-lg font-semibold">
              {pt('releases')}
            </h2>
            {releases.map((release) => {
              const preview = previews[release.id];
              return (
                <details
                  key={release.id}
                  className="rounded-lg border border-border p-4"
                  onToggle={(event) => {
                    if (event.currentTarget.open) void loadPreview(release.id);
                  }}
                >
                  <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <span className="font-medium">
                      {pt('preview')} {release.contractId} / {release.catalogSetRevision}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {pt('languages')}: {languageNames(release.supportedLocales)} ·{' '}
                      {pt('draftRevision')}: {release.draftRevision}
                    </span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    {!platform && (
                      <a
                        href={`/api/v1/iam/app-translations?operation=downloadTexts&releaseId=${encodeURIComponent(release.id)}&mode=${sourceOnly ? 'source' : 'translations'}`}
                        download="texts.js"
                        aria-disabled={downloadingId !== null}
                        className="inline-block rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-wait aria-disabled:opacity-50"
                        onClick={(event) => {
                          event.preventDefault();
                          if (downloadingId === null) void downloadTexts(release.id);
                        }}
                      >
                        {pt(downloadingId === release.id ? 'downloadingTexts' : 'downloadTexts')}
                      </a>
                    )}
                    <p className="text-sm text-muted-foreground">{pt('localOnly')}</p>
                    {preview?.status === 'loading' && <p role="status">{pt('loading')}</p>}
                    {preview?.status === 'error' && <p role="alert">{pt('catalog_unavailable')}</p>}
                    {preview?.status === 'ready' && (
                      <pre
                        tabIndex={0}
                        aria-label={`${pt('preview')} / ${release.catalogSetRevision}`}
                        className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs"
                      >
                        {JSON.stringify(preview.release, null, 2)}
                      </pre>
                    )}
                  </div>
                </details>
              );
            })}
            {releases.length === 0 && <p>{pt('noReleases')}</p>}
          </section>
        </>
      )}
    </StudioOverviewPageTemplate>
  );
};

export const TranslationCatalogsPage = () => <CatalogsPage sourceOnly={false} />;
