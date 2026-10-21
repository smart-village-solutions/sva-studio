import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  APP_TRANSLATION_LOCALES,
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
import { requestCatalog } from './catalog.api.js';
import { CatalogEditor } from './catalog.editor.js';

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
  const [preview, setPreview] = useState<CatalogRelease | null>(null);
  const [baseId, setBaseId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
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
    setDirty(false);
    setPreview(null);
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
    setDirty(false);
    setPreview(null);
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
      if ('state' in result && result.state === 'sealed') setPreview(result);
      setNotice('saved');
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
  const selectedBase = overview?.bases.find((base) => base.id === baseId);
  const changingBase = Boolean(data && selectedBase?.contractId === contractId);
  const loadPreview = async (id: string) => {
    if (!overview) return;
    setBusy(true);
    setError('');
    try {
      setPreview(
        await catalog<CatalogRelease>({ operation: 'readRelease', releaseId: id }, overview.scope)
      );
    } catch (reason) {
      setError(errorCode(reason));
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
              'catalog_setup_required',
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
              <label className="block space-y-2">
                {pt('chooseBasis')}
                <Select
                  value={baseId}
                  disabled={busy || dirty || !canWrite}
                  onChange={(event) => setBaseId(event.target.value)}
                >
                  <option value="">{pt('choose')}</option>
                  {overview.bases.map((base) => (
                    <option key={base.id} value={base.id}>
                      {base.contractId} / {base.catalogSetRevision} /{' '}
                      {languageNames(base.supportedLocales)}
                    </option>
                  ))}
                </Select>
              </label>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || dirty || !canWrite || !selectedBase}
                onClick={() => {
                  if (selectedBase)
                    void mutate(
                      changingBase && data
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
                }}
              >
                {pt(changingBase ? 'changeBasis' : 'create')}
              </Button>
            </section>
          )}
          {!sourceOnly && overview.catalogs.length === 0 && <p>{pt('sourceRequired')}</p>}
          {contractId && !data && !error && <p role="status">{pt('loading')}</p>}
          {data && (
            <>
              <dl className="flex flex-wrap gap-6 rounded-lg bg-muted p-4 text-sm">
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
              <CatalogEditor
                key={`${data.draft.id}:${editorVersion}`}
                data={data}
                busy={busy}
                canWrite={canWrite}
                sourceOnly={sourceOnly}
                mutate={mutate}
                onDirtyChange={setDirty}
              />
              <Button
                type="button"
                disabled={!canPublish || busy || dirty}
                onClick={() =>
                  void mutate({
                    operation: 'seal',
                    contractId,
                    expectedRevision: data.draft.draftRevision,
                  })
                }
              >
                {pt('seal')}
              </Button>
            </>
          )}
          <section
            className="space-y-3 border-t border-border pt-5"
            aria-labelledby="catalog-releases-heading"
          >
            <h2 id="catalog-releases-heading" className="text-lg font-semibold">
              {pt('releases')}
            </h2>
            {releases.map((release) => (
              <Button
                key={release.id}
                type="button"
                variant="secondary"
                disabled={busy || dirty}
                onClick={() => void loadPreview(release.id)}
              >
                {pt('preview')} {release.contractId} / {release.catalogSetRevision}
              </Button>
            ))}
            {releases.length === 0 && <p>{pt('noReleases')}</p>}
          </section>
          {preview && (
            <section
              className="space-y-3 rounded-lg border border-border p-5"
              aria-labelledby="catalog-preview-heading"
            >
              <h2 id="catalog-preview-heading" className="text-lg font-semibold">
                {pt('preview')} / {preview.catalogSetRevision}
              </h2>
              <p role="status" className="text-sm text-muted-foreground">
                {pt('localOnly')}
              </p>
              <pre
                tabIndex={0}
                aria-label={pt('preview')}
                className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs"
              >
                {JSON.stringify(preview, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}
    </StudioOverviewPageTemplate>
  );
};

export const TranslationCatalogsPage = () => <CatalogsPage sourceOnly={false} />;
