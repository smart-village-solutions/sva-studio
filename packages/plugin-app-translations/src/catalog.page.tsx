import { useEffect } from 'react';
import { Button, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import { CatalogDraftContent } from './catalog.page.draft.js';
import { useCatalogPageModel } from './catalog.page.state.js';
import {
  mutate as mutateAction,
  translate as translateAction,
  importFile as importFileAction,
  applyBase as applyBaseAction,
  seal as sealAction,
  reloadCatalog as reloadCatalogAction,
} from './catalog.page.mutations.js';
import {
  downloadTexts as downloadTextsAction,
  loadPreview as loadPreviewAction,
} from './catalog.page.snapshots.js';
import {
  useCatalogOverview,
  useCatalogDraft,
  useCatalogJob,
  useCatalogCounts,
} from './catalog.page.loading.js';
import {
  catalogPageHeading,
  CatalogMessages,
  CatalogScope,
  CatalogImport,
  CatalogSelection,
} from './catalog.page.overview.js';
import { CatalogBasis } from './catalog.page.basis.js';
import { CatalogReleases } from './catalog.page.releases.js';
export const CatalogsPage = ({
  platform = false,
  sourceOnly = true,
}: { platform?: boolean; sourceOnly?: boolean } = {}) => {
  const state = useCatalogPageModel(platform, sourceOnly);
  useCatalogOverview(state);
  useCatalogDraft(state);
  useCatalogJob(state);
  useCatalogCounts(state);
  const model = {
    ...state,
    mutate: mutateAction.bind(null, state),
    translate: translateAction.bind(null, state),
    importFile: importFileAction.bind(null, state),
    applyBase: applyBaseAction.bind(null, state),
    seal: sealAction.bind(null, state),
    reloadCatalog: reloadCatalogAction.bind(null, state),
    downloadTexts: downloadTextsAction.bind(null, state),
    loadPreview: loadPreviewAction.bind(null, state),
  };
  const {
    pt,
    overview,
    error,
    busy,
    dirty,
    data,
    contractId,
    reloadCatalog,
    downloadController,
    setDownloadingId,
  } = model;
  useEffect(() => {
    setDownloadingId(null);
    return () => downloadController.current?.abort();
  }, [overview, sourceOnly]);
  return (
    <StudioOverviewPageTemplate
      {...catalogPageHeading(model)}
      primaryAction={
        <Button type="button" variant="secondary" disabled={busy || dirty} onClick={reloadCatalog}>
          {pt('reload')}
        </Button>
      }
    >
      <CatalogMessages model={model} />
      {overview && (
        <>
          <CatalogScope model={model} />
          {platform && <CatalogImport model={model} />}
          <CatalogSelection model={model} />
          {!platform && sourceOnly && <CatalogBasis model={model} />}
          {!sourceOnly && overview.catalogs.length === 0 && <p>{pt('sourceRequired')}</p>}
          {contractId && !data && !error && <p role="status">{pt('loading')}</p>}
          {data && <CatalogDraftContent model={model} />}
          <CatalogReleases model={model} />
        </>
      )}
    </StudioOverviewPageTemplate>
  );
};
export const TranslationCatalogsPage = () => <CatalogsPage sourceOnly={false} />;
