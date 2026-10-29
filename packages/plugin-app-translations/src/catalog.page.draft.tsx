import { Button } from '@sva/studio-ui-react';
import { CatalogEditor } from './catalog.editor.js';
import { type CatalogPageViewModel, draftDetails } from './catalog.page.state.js';
import { CatalogConfigure, CatalogTranslation } from './catalog.page.translation.js';
export const CatalogDraftStatus = ({ model }: { model: CatalogPageViewModel }) => {
  const { pt, seal } = model;
  const { savedDraftRelease, draftStatus, canSeal } = draftDetails(model);
  return (
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
      <CatalogDraftMetadata model={model} />
      <Button type="button" disabled={!canSeal} onClick={() => void seal()}>
        {pt('seal')}
      </Button>
    </section>
  );
};

export const CatalogDraftMetadata = ({ model }: { model: CatalogPageViewModel }) => {
  const { data, pt, languageNames } = model;
  if (!data) return null;
  return (
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
  );
};

export const CatalogSealIssues = ({ model }: { model: CatalogPageViewModel }) => {
  const { dirty, busy, sealIssues, setRequestedSelection, pt, languageName } = model;
  return (
    <>
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
                  onClick={() => setRequestedSelection({ locale: issue.locale, key: issue.key })}
                >
                  {languageName(issue.locale)} · {issue.key} · {pt(issue.reason)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export const CatalogDraftContent = ({ model }: { model: CatalogPageViewModel }) => {
  const {
    data,
    setDirty,
    busy,
    requestedSelection,
    editorVersion,
    sourceOnly,
    canWrite,
    jobActive,
    translate,
    mutate,
  } = model;
  if (!data) return null;
  return (
    <>
      {!sourceOnly && <CatalogConfigure model={model} />}
      {!sourceOnly && <CatalogTranslation model={model} />}
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
      <CatalogDraftStatus model={model} />
      <CatalogSealIssues model={model} />
    </>
  );
};
