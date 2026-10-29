import { type CatalogOverview } from '@sva/plugin-sdk/app-translations';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  type CatalogPageViewModel,
  draftDetails,
  type ReleasePreview,
} from './catalog.page.state.js';

export const CatalogRelease = ({
  model,
  release,
}: {
  model: CatalogPageViewModel;
  release: CatalogOverview['releases'][number];
}) => {
  const {
    previews,

    downloadingId,
    pt,
    languageNames,
    sourceOnly,
    platform,

    downloadTexts,
    loadPreview,
  } = model;
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
          {pt('languages')}: {languageNames(release.supportedLocales)} · {pt('draftRevision')}:{' '}
          {release.draftRevision}
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
        <CatalogReleasePreview preview={preview} revision={release.catalogSetRevision} />
      </div>
    </details>
  );
};

export const CatalogReleasePreview = ({
  preview,
  revision,
}: {
  preview?: ReleasePreview;
  revision: string;
}) => {
  const pt = usePluginTranslation('appTranslations.ui');
  return (
    <>
      {preview?.status === 'loading' && <p role="status">{pt('loading')}</p>}
      {preview?.status === 'error' && <p role="alert">{pt('catalog_unavailable')}</p>}
      {preview?.status === 'ready' && (
        <pre
          tabIndex={0}
          aria-label={`${pt('preview')} / ${revision}`}
          className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs"
        >
          {JSON.stringify(preview.release, null, 2)}
        </pre>
      )}
    </>
  );
};

export const CatalogReleases = ({ model }: { model: CatalogPageViewModel }) => {
  const { pt } = model;
  const { releases } = draftDetails(model);
  return (
    <section
      className="space-y-3 border-t border-border pt-5"
      aria-labelledby="catalog-releases-heading"
    >
      <h2 id="catalog-releases-heading" className="text-lg font-semibold">
        {pt('releases')}
      </h2>
      {releases.map((release) => (
        <CatalogRelease key={release.id} release={release} model={model} />
      ))}
      {releases.length === 0 && <p>{pt('noReleases')}</p>}
    </section>
  );
};
